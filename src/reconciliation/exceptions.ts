// src/reconciliation/exceptions.ts
// Deterministic exception classification and rule enforcement.
// Implements the 6 canonical exception types according to PROJECT_SPEC and ARCHITECTURE.

import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { SupportingDocument } from "../schemas/supporting-document";
import { Exception } from "../schemas/exception";
import { EvidenceItem } from "../schemas/evidence-item";
import { MatchResult } from "./types";
import { DuplicateGroup } from "./duplicates";
import { AccountBaseline, checkTransactionAnomaly } from "./anomaly";
import { parseCents } from "../utils/money";
import {
  createCalculationEvidence,
  createDocumentEvidence,
  createMatchRuleEvidence,
  createMissingDocumentEvidence,
  createSourceRecordEvidence,
} from "./evidence";

export type ExceptionClassificationResult = {
  exceptions: Exception[];
  evidenceItems: EvidenceItem[];
  overallStatus: "matched" | "exception" | "review_required";
  autoResolutionAllowed: boolean;
};

/**
 * Classifies exceptions deterministically based on match results, duplicates, anomaly checks, and documents.
 */
export function classifyExceptions(
  resultId: string,
  bankTx: BankTransaction,
  matchResult: MatchResult,
  documents: SupportingDocument[],
  ledgerDuplicates: DuplicateGroup<LedgerEntry>[],
  accountBaselines: Map<string, AccountBaseline>,
  createdAt: string = new Date().toISOString()
): ExceptionClassificationResult {
  const exceptions: Exception[] = [];
  const evidenceItems: EvidenceItem[] = [];

  // Base evidence: bank transaction source record
  const bankEvidence = createSourceRecordEvidence(
    "result",
    resultId,
    "bank_transaction",
    bankTx,
    createdAt
  );
  evidenceItems.push(bankEvidence);

  // Evidence for each candidate ledger entry
  for (const candidate of matchResult.candidates) {
    evidenceItems.push(
      createSourceRecordEvidence(
        "result",
        resultId,
        "ledger_entry",
        candidate.entry,
        createdAt
      )
    );
  }

  // Evidence for each rule trace step
  for (const step of matchResult.ruleTrace) {
    evidenceItems.push(
      createMatchRuleEvidence("result", resultId, step, createdAt)
    );
  }

  // Helper to register an exception
  const addException = (
    type: Exception["type"],
    severity: Exception["severity"],
    reasonCode: string,
    specificEvidence: EvidenceItem[]
  ) => {
    const exId = `EX-${type.toUpperCase()}-${resultId}`;
    const evidenceIds = specificEvidence.map((e) => e.id);

    exceptions.push({
      id: exId,
      resultId,
      type,
      severity,
      status: "open",
      reasonCode,
      evidenceIds,
      createdAt,
    });
  };

  // 1. Unmatched Transaction Exception
  if (matchResult.status === "no_candidate") {
    const exEvidence = createMatchRuleEvidence(
      "exception",
      resultId,
      {
        rule: "unmatched_transaction_rule",
        description: "No eligible ledger entry candidate was found for this bank transaction",
        passed: true,
        details: {
          accountId: bankTx.accountId,
          currency: bankTx.currency,
          amount: bankTx.amount,
          reference: bankTx.reference,
        },
      },
      createdAt
    );
    evidenceItems.push(exEvidence);
    addException(
      "unmatched_transaction",
      "high",
      "UNMATCHED_NO_CANDIDATE",
      [bankEvidence, exEvidence]
    );
  }

  // 2. Duplicate Exception
  // Check if candidate ledger entries belong to a detected duplicate cluster
  const candidateIds = new Set(matchResult.candidateLedgerEntryIds);
  const matchedDuplicateGroups = ledgerDuplicates.filter(
    (group) => group.recordIds.some((id) => candidateIds.has(id))
  );

  if (matchedDuplicateGroups.length > 0) {
    for (const group of matchedDuplicateGroups) {
      const dupEvidence = createMatchRuleEvidence(
        "exception",
        resultId,
        {
          rule: "duplicate_detection_rule",
          description: `Multiple ledger entries (${group.recordIds.join(", ")}) share account, amount (${group.amount}), and reference (${group.reference}) within ${group.dateRangeDays} days`,
          passed: true,
          details: {
            groupId: group.groupId,
            duplicateRecordIds: group.recordIds,
            reference: group.reference,
            amount: group.amount,
          },
        },
        createdAt
      );
      evidenceItems.push(dupEvidence);

      addException(
        "duplicate",
        "high",
        "DUPLICATE_CANDIDATE_CLUSTER",
        [bankEvidence, dupEvidence]
      );
    }
  }

  // 3. Amount Mismatch Exception
  if (matchResult.status === "amount_mismatch") {
    const calcEvidence = createCalculationEvidence(
      "exception",
      resultId,
      "amount_difference",
      {
        bankAmount: bankTx.amount,
        ledgerAmount: matchResult.selectedMatch
          ? ("amount" in matchResult.selectedMatch ? (matchResult.selectedMatch as any).amount : (matchResult.selectedMatch as any).debit)
          : undefined,
        amountDifference: matchResult.amountDifference,
      },
      createdAt
    );
    evidenceItems.push(calcEvidence);

    addException(
      "amount_mismatch",
      "medium",
      "AMOUNT_MISMATCH",
      [bankEvidence, calcEvidence]
    );
  }

  // 4. Timing Difference Exception
  if (matchResult.status === "timing_difference") {
    const timingCandidate = matchResult.candidates.find(
      (c) => c.classification === "timing_difference"
    );
    const dateDiffDays = timingCandidate?.dateDifferenceDays ?? 0;

    const calcEvidence = createCalculationEvidence(
      "exception",
      resultId,
      "date_difference",
      {
        bankDate: bankTx.transactionDate,
        ledgerDate: timingCandidate?.entry.entryDate,
        dateDifferenceDays: dateDiffDays,
      },
      createdAt
    );
    evidenceItems.push(calcEvidence);

    addException(
      "timing_difference",
      "low",
      "TIMING_DIFFERENCE",
      [bankEvidence, calcEvidence]
    );
  }

  // 5. Potential Anomaly Exception (deterministic account outlier check)
  const anomalyCheck = checkTransactionAnomaly(bankTx, accountBaselines);
  if (anomalyCheck.isAnomaly) {
    const anomalyEvidence = createCalculationEvidence(
      "exception",
      resultId,
      "anomaly_threshold",
      {
        transactionAmount: bankTx.amount,
        accountThreshold: anomalyCheck.thresholdFormatted,
        reason: anomalyCheck.reason,
      },
      createdAt
    );
    evidenceItems.push(anomalyEvidence);

    addException(
      "potential_anomaly",
      "high",
      "ACCOUNT_AMOUNT_OUTLIER",
      [bankEvidence, anomalyEvidence]
    );
  }

  // 6. Missing Documentation Exception
  // Evaluated for selected match or single candidates
  const primaryEntry = matchResult.selectedMatch || (matchResult.candidates.length === 1 ? matchResult.candidates[0].entry : undefined);

  if (primaryEntry) {
    const docIds = primaryEntry.documentIds || [];
    let isDocMissing = false;
    let missingReason = "";

    if (docIds.length === 0) {
      isDocMissing = true;
      missingReason = `Ledger entry ${primaryEntry.id} has no linked supporting documents (documentIds is empty)`;
    } else {
      const docMap = new Map(documents.map((d) => [d.id, d]));
      for (const dId of docIds) {
        if (!docMap.has(dId)) {
          isDocMissing = true;
          missingReason = `Linked document ${dId} not found in available supporting documents`;
          break;
        } else {
          // Document exists: record evidence
          const docItem = docMap.get(dId)!;
          evidenceItems.push(
            createDocumentEvidence("result", resultId, docItem, createdAt)
          );
        }
      }
    }

    // Flag missing_documentation if ledger entry has no linked documentation and this isn't an anomaly or unmatched transaction
    if (isDocMissing && matchResult.status === "exact_match" && !anomalyCheck.isAnomaly) {
      const missDocEvidence = createMissingDocumentEvidence(
        "exception",
        resultId,
        primaryEntry.id,
        missingReason,
        createdAt
      );
      evidenceItems.push(missDocEvidence);

      addException(
        "missing_documentation",
        "medium",
        "MISSING_LINKED_DOCUMENT",
        [bankEvidence, missDocEvidence]
      );
    }
  }

  // Determine overall status
  let overallStatus: "matched" | "exception" | "review_required";
  let autoResolutionAllowed = false;

  // Policy guard for high-value / unverified account baseline transactions:
  // Under accounting controls and HIGH_VALUE_ANOMALY_GUARD, exact matches exceeding
  // the high-value policy threshold ($10,000.00) cannot autonomously close without human review.
  const HIGH_VALUE_THRESHOLD_CENTS = 1000000n; // $10,000.00
  const txAmountCents = parseCents(bankTx.amount);
  const baseline = accountBaselines?.get(bankTx.accountId);
  const isHighValueOrUnverified =
    txAmountCents >= HIGH_VALUE_THRESHOLD_CENTS ||
    (baseline !== undefined && baseline.sampleCount < 2 && txAmountCents >= HIGH_VALUE_THRESHOLD_CENTS);

  if (exceptions.length > 0) {
    overallStatus = "exception";
    autoResolutionAllowed = false;
  } else if (matchResult.status === "ambiguous_candidates") {
    overallStatus = "review_required";
    autoResolutionAllowed = false;
  } else if (matchResult.status === "exact_match") {
    if (isHighValueOrUnverified) {
      overallStatus = "review_required";
      autoResolutionAllowed = false;
    } else {
      overallStatus = "matched";
      autoResolutionAllowed = true;
    }
  } else {
    overallStatus = "review_required";
    autoResolutionAllowed = false;
  }

  return {
    exceptions,
    evidenceItems,
    overallStatus,
    autoResolutionAllowed,
  };
}
