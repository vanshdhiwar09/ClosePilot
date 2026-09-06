// src/reconciliation/matcher.ts
// Deterministic bank transaction -> ledger entry candidate matcher.
// No LLMs, no floating-point math, no split/many-to-one matching, no auto-resolving ambiguous candidates.

import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry, getLedgerSignedAmount } from "../schemas/ledger-entry";
import {
  absDifferenceMoney,
  isEqualMoney,
} from "../utils/money";
import { calculateDateDifferenceDays } from "./date";
import {
  normalizeReference,
  normalizeVendor,
  computeTokenOverlap,
} from "./normalize";
import {
  CandidateClassification,
  CandidateLedgerEntry,
  MatchClassification,
  MatcherConfig,
  MatchResult,
  RuleTraceStep,
} from "./types";

const DEFAULT_CONFIG: Required<MatcherConfig> = {
  configVersion: "2024.1",
  exactDateWindowDays: 0,
  strongDateWindowDays: 2,
  timingDateWindowDays: 30,
  vendorAliases: {},
};

/**
 * Deterministically evaluates candidates and matches a BankTransaction against LedgerEntries.
 */
export function matchBankTransaction(
  bankTx: BankTransaction,
  ledgerEntries: LedgerEntry[],
  options?: MatcherConfig
): MatchResult {
  const config: Required<MatcherConfig> = {
    ...DEFAULT_CONFIG,
    ...options,
    vendorAliases: {
      ...DEFAULT_CONFIG.vendorAliases,
      ...options?.vendorAliases,
    },
  };

  const ruleTrace: RuleTraceStep[] = [];

  // Step 1: Account and currency filtering
  const accountEntries = ledgerEntries.filter(
    (entry) =>
      entry.accountId === bankTx.accountId &&
      entry.currency.toUpperCase() === bankTx.currency.toUpperCase()
  );

  ruleTrace.push({
    rule: "account_currency_filter",
    description: "Filter ledger entries by matching accountId and currency",
    passed: accountEntries.length > 0,
    details: {
      targetAccountId: bankTx.accountId,
      targetCurrency: bankTx.currency,
      totalEntriesChecked: ledgerEntries.length,
      matchingAccountEntriesCount: accountEntries.length,
    },
  });

  if (accountEntries.length === 0) {
    return {
      bankTransactionId: bankTx.id,
      status: "no_candidate",
      selectedMatch: undefined,
      candidates: [],
      candidateLedgerEntryIds: [],
      matchedLedgerEntryIds: [],
      amountDifference: bankTx.amount,
      ruleTrace,
      confidence: "low",
      requiresReview: true,
      configVersion: config.configVersion,
    };
  }

  // Normalized bank transaction fields
  const normBankRef = normalizeReference(bankTx.reference);
  const normBankVendor = normalizeVendor(bankTx.counterparty, config.vendorAliases);

  // Step 2: Score and classify each candidate in the account
  const candidates: CandidateLedgerEntry[] = [];

  for (const entry of accountEntries) {
    const signedAmount = getLedgerSignedAmount(entry);
    const amountDiff = absDifferenceMoney(bankTx.amount, signedAmount);
    const amountEquals = isEqualMoney(bankTx.amount, signedAmount);
    const dateDiff = calculateDateDifferenceDays(bankTx.transactionDate, entry.entryDate);

    const normLedgerRef = normalizeReference(entry.reference);
    const refMatch = Boolean(normBankRef && normLedgerRef && normBankRef === normLedgerRef);

    const normLedgerVendor = normalizeVendor(entry.vendor, config.vendorAliases);
    const vendorMatch = Boolean(normBankVendor && normLedgerVendor && normBankVendor === normLedgerVendor);

    const tokenOverlap = computeTokenOverlap(bankTx.description, entry.memo || entry.vendor);

    let classification: CandidateClassification | null = null;
    const reasons: string[] = [];

    // 1. Exact candidate criteria:
    // Amount equal + reference match (or vendor match) + date within exact window (0 days)
    if (amountEquals && (refMatch || vendorMatch) && dateDiff <= config.exactDateWindowDays) {
      classification = "exact";
      reasons.push("Exact amount match");
      if (refMatch) reasons.push(`Reference matches ("${normBankRef}")`);
      if (vendorMatch) reasons.push(`Vendor matches ("${normBankVendor}")`);
      reasons.push(`Date difference (${dateDiff} days) within exact window (<= ${config.exactDateWindowDays} days)`);
    }
    // 2. Timing candidate criteria (Reference matched, but date outside exact window):
    else if (
      amountEquals &&
      refMatch &&
      dateDiff > config.exactDateWindowDays &&
      dateDiff <= config.timingDateWindowDays
    ) {
      classification = "timing_difference";
      reasons.push("Exact amount match");
      reasons.push(`Reference matches ("${normBankRef}")`);
      reasons.push(
        `Date difference (${dateDiff} days) outside exact window (<= ${config.exactDateWindowDays} days) but within timing window (<= ${config.timingDateWindowDays} days)`
      );
    }
    // 3. Strong candidate criteria (No reference match, but vendor or description token match within strong window):
    else if (amountEquals && (vendorMatch || tokenOverlap > 0) && dateDiff <= config.strongDateWindowDays) {
      classification = "strong";
      reasons.push("Exact amount match");
      if (vendorMatch) reasons.push(`Vendor matches ("${normBankVendor}")`);
      if (tokenOverlap > 0) reasons.push(`Description token overlap (${tokenOverlap} tokens)`);
      reasons.push(`Date difference (${dateDiff} days) within strong window (<= ${config.strongDateWindowDays} days)`);
    }
    // 4. Timing candidate criteria (Vendor matched without reference, date outside strong window):
    else if (
      amountEquals &&
      vendorMatch &&
      dateDiff > config.strongDateWindowDays &&
      dateDiff <= config.timingDateWindowDays
    ) {
      classification = "timing_difference";
      reasons.push("Exact amount match");
      reasons.push(`Vendor matches ("${normBankVendor}")`);
      reasons.push(
        `Date difference (${dateDiff} days) outside strong window (<= ${config.strongDateWindowDays} days) but within timing window (<= ${config.timingDateWindowDays} days)`
      );
    }
    // 5. Amount mismatch candidate criteria:
    // Unequal amount + reference match OR (vendor match and date within strong window)
    else if (!amountEquals && (refMatch || (vendorMatch && dateDiff <= config.strongDateWindowDays))) {
      classification = "amount_mismatch";
      if (refMatch) reasons.push(`Reference matches ("${normBankRef}")`);
      if (vendorMatch) reasons.push(`Vendor matches ("${normBankVendor}")`);
      reasons.push(`Amount mismatch: bank ${bankTx.amount} vs ledger ${signedAmount} (diff: ${amountDiff})`);
      reasons.push(`Date difference: ${dateDiff} days`);
    }
    // 6. Weak candidate criteria:
    // Reference match or vendor match but fails date/amount windows
    else if (refMatch || (vendorMatch && dateDiff <= config.timingDateWindowDays)) {
      classification = "weak";
      if (refMatch) reasons.push(`Reference matches ("${normBankRef}")`);
      if (vendorMatch) reasons.push(`Vendor matches ("${normBankVendor}")`);
      reasons.push(`Fails primary match criteria: amount diff ${amountDiff}, date diff ${dateDiff} days`);
    }

    if (classification) {
      candidates.push({
        entry,
        classification,
        amountDifference: amountDiff,
        dateDifferenceDays: dateDiff,
        referenceMatch: refMatch,
        vendorMatch,
        tokenOverlap,
        reasons,
      });
    }
  }

  ruleTrace.push({
    rule: "candidate_discovery",
    description: "Evaluate account ledger entries against candidate criteria",
    passed: candidates.length > 0,
    details: {
      candidatesDiscoveredCount: candidates.length,
      candidateClassifications: candidates.map((c) => ({
        entryId: c.entry.id,
        classification: c.classification,
        amountDiff: c.amountDifference,
        dateDiffDays: c.dateDifferenceDays,
      })),
    },
  });

  // Step 3: Match resolution and disambiguation by rule precedence
  const exactCandidates = candidates.filter((c) => c.classification === "exact");
  const strongCandidates = candidates.filter((c) => c.classification === "strong");
  const timingCandidates = candidates.filter((c) => c.classification === "timing_difference");
  const amountMismatchCandidates = candidates.filter((c) => c.classification === "amount_mismatch");

  const candidateIds = candidates.map((c) => c.entry.id);

  // Precedence 1: Exact candidates
  if (exactCandidates.length === 1) {
    const selected = exactCandidates[0];
    ruleTrace.push({
      rule: "exact_match_rule",
      description: "Single unique candidate met all exact match requirements",
      passed: true,
      details: {
        selectedEntryId: selected.entry.id,
        reasons: selected.reasons,
      },
    });

    return {
      bankTransactionId: bankTx.id,
      status: "exact_match",
      selectedMatch: selected.entry,
      candidates,
      candidateLedgerEntryIds: candidateIds,
      matchedLedgerEntryIds: [selected.entry.id],
      amountDifference: selected.amountDifference,
      ruleTrace,
      confidence: "high",
      requiresReview: false,
      configVersion: config.configVersion,
    };
  }

  if (exactCandidates.length > 1) {
    ruleTrace.push({
      rule: "ambiguous_exact_candidates",
      description: "Multiple competing candidates met exact matching requirements; cannot auto-resolve",
      passed: true,
      details: {
        competingEntryIds: exactCandidates.map((c) => c.entry.id),
      },
    });

    return {
      bankTransactionId: bankTx.id,
      status: "ambiguous_candidates",
      selectedMatch: undefined,
      candidates,
      candidateLedgerEntryIds: candidateIds,
      matchedLedgerEntryIds: [],
      amountDifference: "0.00",
      ruleTrace,
      confidence: "low",
      requiresReview: true,
      configVersion: config.configVersion,
    };
  }

  // Precedence 2: Strong candidates
  if (strongCandidates.length === 1) {
    const selected = strongCandidates[0];
    ruleTrace.push({
      rule: "strong_match_rule",
      description: "Single unique candidate met strong match requirements (vendor/token within date tolerance)",
      passed: true,
      details: {
        selectedEntryId: selected.entry.id,
        reasons: selected.reasons,
      },
    });

    return {
      bankTransactionId: bankTx.id,
      status: "strong_match",
      selectedMatch: selected.entry,
      candidates,
      candidateLedgerEntryIds: candidateIds,
      matchedLedgerEntryIds: [selected.entry.id],
      amountDifference: selected.amountDifference,
      ruleTrace,
      confidence: "medium",
      requiresReview: false,
      configVersion: config.configVersion,
    };
  }

  if (strongCandidates.length > 1) {
    ruleTrace.push({
      rule: "ambiguous_strong_candidates",
      description: "Multiple competing candidates met strong matching requirements; cannot auto-resolve",
      passed: true,
      details: {
        competingEntryIds: strongCandidates.map((c) => c.entry.id),
      },
    });

    return {
      bankTransactionId: bankTx.id,
      status: "ambiguous_candidates",
      selectedMatch: undefined,
      candidates,
      candidateLedgerEntryIds: candidateIds,
      matchedLedgerEntryIds: [],
      amountDifference: "0.00",
      ruleTrace,
      confidence: "low",
      requiresReview: true,
      configVersion: config.configVersion,
    };
  }

  // Precedence 3: Timing difference candidates
  if (timingCandidates.length === 1) {
    const selected = timingCandidates[0];
    ruleTrace.push({
      rule: "timing_difference_rule",
      description: "Candidate matches amount and reference/vendor but falls outside exact date window",
      passed: true,
      details: {
        selectedEntryId: selected.entry.id,
        dateDifferenceDays: selected.dateDifferenceDays,
        reasons: selected.reasons,
      },
    });

    return {
      bankTransactionId: bankTx.id,
      status: "timing_difference",
      selectedMatch: selected.entry,
      candidates,
      candidateLedgerEntryIds: candidateIds,
      matchedLedgerEntryIds: [selected.entry.id],
      amountDifference: selected.amountDifference,
      ruleTrace,
      confidence: "medium",
      requiresReview: true,
      configVersion: config.configVersion,
    };
  }

  if (timingCandidates.length > 1) {
    ruleTrace.push({
      rule: "ambiguous_timing_candidates",
      description: "Multiple candidates matched in timing difference window; routed to human review",
      passed: true,
      details: {
        competingEntryIds: timingCandidates.map((c) => c.entry.id),
      },
    });

    return {
      bankTransactionId: bankTx.id,
      status: "ambiguous_candidates",
      selectedMatch: undefined,
      candidates,
      candidateLedgerEntryIds: candidateIds,
      matchedLedgerEntryIds: [],
      amountDifference: "0.00",
      ruleTrace,
      confidence: "low",
      requiresReview: true,
      configVersion: config.configVersion,
    };
  }

  // Precedence 4: Amount mismatch candidates
  if (amountMismatchCandidates.length === 1) {
    const selected = amountMismatchCandidates[0];
    ruleTrace.push({
      rule: "amount_mismatch_rule",
      description: "Candidate matches reference/vendor and date but amounts differ",
      passed: true,
      details: {
        selectedEntryId: selected.entry.id,
        amountDifference: selected.amountDifference,
        reasons: selected.reasons,
      },
    });

    return {
      bankTransactionId: bankTx.id,
      status: "amount_mismatch",
      selectedMatch: selected.entry,
      candidates,
      candidateLedgerEntryIds: candidateIds,
      matchedLedgerEntryIds: [selected.entry.id],
      amountDifference: selected.amountDifference,
      ruleTrace,
      confidence: "low",
      requiresReview: true,
      configVersion: config.configVersion,
    };
  }

  if (amountMismatchCandidates.length > 1) {
    ruleTrace.push({
      rule: "ambiguous_amount_mismatch_candidates",
      description: "Multiple candidates with amount mismatch; routed to human review",
      passed: true,
      details: {
        competingEntryIds: amountMismatchCandidates.map((c) => c.entry.id),
      },
    });

    return {
      bankTransactionId: bankTx.id,
      status: "ambiguous_candidates",
      selectedMatch: undefined,
      candidates,
      candidateLedgerEntryIds: candidateIds,
      matchedLedgerEntryIds: [],
      amountDifference: amountMismatchCandidates[0].amountDifference,
      ruleTrace,
      confidence: "low",
      requiresReview: true,
      configVersion: config.configVersion,
    };
  }

  // Fallback: No candidate qualified under matching rules
  ruleTrace.push({
    rule: "unmatched_fallback",
    description: "No candidates satisfied any exact, strong, timing, or mismatch matching rule",
    passed: false,
    details: {
      weakCandidatesCount: candidates.length,
    },
  });

  return {
    bankTransactionId: bankTx.id,
    status: "no_candidate",
    selectedMatch: undefined,
    candidates,
    candidateLedgerEntryIds: candidateIds,
    matchedLedgerEntryIds: [],
    amountDifference: bankTx.amount,
    ruleTrace,
    confidence: "low",
    requiresReview: true,
    configVersion: config.configVersion,
  };
}
