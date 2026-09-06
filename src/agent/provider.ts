import { calculateDateDifferenceDays } from "../reconciliation/date";
import { formatCurrency } from "../utils/money";
import {
  CaseDetail,
  InvestigationConfidence,
  RecommendationAction,
  RiskLevel,
} from "./types";

export type ModelPrompt = {
  systemPrompt: string;
  userPrompt: string;
  caseDetail: CaseDetail;
  investigationObservations: Record<string, unknown>;
};

export type ModelAnalysisResponse = {
  summary: string;
  rootCause: string;
  reasoning: string[];
  recommendedAction: RecommendationAction;
  targetLedgerEntryId?: string;
  suggestedReason: string;
  requiredEvidenceTypes?: string[];
  confidence: InvestigationConfidence;
  riskLevel: RiskLevel;
  citedEvidenceIds: string[];
  usage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  model?: string;
  _modelProvider?: string;
  durationMs?: number;
};

export interface InvestigationModelProvider {
  readonly name: string;
  analyzeCase(prompt: ModelPrompt): Promise<ModelAnalysisResponse>;
}

/**
 * Deterministic model provider grounded in accounting domain rules.
 * Produces structured analysis responses derived dynamically from case details and evidence.
 */
export class DeterministicMockProvider implements InvestigationModelProvider {
  public readonly name = "deterministic_accounting_model_v1";

  public async analyzeCase(prompt: ModelPrompt): Promise<ModelAnalysisResponse> {
    const { caseDetail } = prompt;
    const exceptions = caseDetail.exceptions.map((e) => e.type);
    const availableEvidenceIds = caseDetail.evidence.map((e) => e.id);
    const bankTx = caseDetail.bankTransaction;
    const candidates = caseDetail.candidateLedgerEntries;
    const candidateIds = candidates.map((e) => e.id);
    const primaryCandidate = candidates[0];

    // Auto-resolved bypass
    if (caseDetail.autoResolutionAllowed && exceptions.length === 0) {
      return {
        summary: "Transaction successfully auto-reconciled with exact candidate match.",
        rootCause: "No exception detected; exact amount, date, and normalized reference match.",
        reasoning: ["Exact matching rule passed with zero discrepancies."],
        recommendedAction: "NO_ACTION_REQUIRED",
        suggestedReason: "Auto-reconciled high-confidence match; no human intervention needed.",
        confidence: "HIGH",
        riskLevel: "LOW",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // Unmatched transaction
    if (exceptions.includes("unmatched_transaction")) {
      return {
        summary: `Bank transaction ${bankTx.id} ($${bankTx.amount}) has no matching ledger entry.`,
        rootCause: `No candidate entry found in account ${bankTx.accountId} matching counterparty ${bankTx.counterparty || bankTx.description}.`,
        reasoning: [
          `Scanned all ledger entries in account ${bankTx.accountId}; zero matching records found.`,
          "Rule account_currency_filter failed to find any candidate.",
        ],
        recommendedAction: "MANUAL_ENTRY_REQUIRED",
        suggestedReason: `Book manual adjusting ledger entry or contact counterparty to confirm payment allocation for ${bankTx.id}.`,
        confidence: "HIGH",
        riskLevel: "HIGH",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // Amount mismatch
    if (exceptions.includes("amount_mismatch")) {
      const candidateId = primaryCandidate?.id;
      const amountDiff = caseDetail.reconciliationResult.amountDifference;
      const ref = bankTx.reference || primaryCandidate?.reference || "N/A";
      return {
        summary: `Bank transaction ${bankTx.id} ($${bankTx.amount}) has an amount discrepancy against candidate ${candidateId || "entry"}.`,
        rootCause: `Reference and dates match, but bank amount ($${bankTx.amount}) differs from ledger debit/credit ($${amountDiff} variance).`,
        reasoning: [
          `Candidate matches on reference ${ref} within the active date window.`,
          `Deterministic variance calculated: $${amountDiff}.`,
        ],
        recommendedAction: "PRICE_ADJUSTMENT_REQUIRED",
        targetLedgerEntryId: candidateId,
        suggestedReason: `Investigate $${amountDiff} price discrepancy with vendor and book adjusting credit memo.`,
        confidence: "HIGH",
        riskLevel: "MEDIUM",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // Timing difference
    if (exceptions.includes("timing_difference")) {
      const candidateId = primaryCandidate?.id;
      const dateDiff = primaryCandidate
        ? calculateDateDifferenceDays(bankTx.transactionDate, primaryCandidate.entryDate)
        : 1;
      const daysText = `${dateDiff} day${dateDiff === 1 ? "" : "s"}`;
      return {
        summary: `Bank transaction ${bankTx.id} matches candidate ${candidateId || "entry"} outside the exact same-day window.`,
        rootCause: `Bank transaction date and ledger entry date differ by ${daysText} (timing clearance difference).`,
        reasoning: [
          `Exact amount and normalized reference match candidate ${candidateId || ""}.`,
          `Timing difference of ${daysText} is within policy clearing tolerance.`,
        ],
        recommendedAction: "APPROVE_MATCH",
        targetLedgerEntryId: candidateId,
        suggestedReason: `${daysText} timing clearance difference is acceptable under month-end reconciliation policy.`,
        confidence: "HIGH",
        riskLevel: "LOW",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // Duplicate candidates
    if (exceptions.includes("duplicate")) {
      const primaryId = candidateIds[0] || "primary";
      const dupIds = candidateIds.slice(1).join(", ");
      return {
        summary: `Bank transaction ${bankTx.id} matched multiple duplicate candidates [${candidateIds.join(", ")}].`,
        rootCause: "Identical amount and normalized reference posted multiple times in general ledger (duplicate cluster).",
        reasoning: [
          `Deterministic duplicate detector identified [${candidateIds.join(", ")}] as a duplicate cluster.`,
          "One ledger entry must be matched and the duplicate voided in the subledger.",
        ],
        recommendedAction: "APPROVE_MATCH",
        targetLedgerEntryId: primaryId,
        suggestedReason: `Approve match with primary entry ${primaryId} and void duplicate subledger entry ${dupIds || primaryId}.`,
        confidence: "HIGH",
        riskLevel: "MEDIUM",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // Missing documentation
    if (exceptions.includes("missing_documentation")) {
      const candidateId = primaryCandidate?.id;
      const ref = bankTx.reference || primaryCandidate?.reference || "transaction";
      return {
        summary: `Candidate entry ${candidateId || "record"} matching bank transaction ${bankTx.id} lacks required supporting documentation.`,
        rootCause: `Ledger entry ${candidateId || "record"} has no linked supporting document or valid invoice metadata.`,
        reasoning: [
          `Amount and reference match candidate ${candidateId || ""}.`,
          "Audit policy requires invoice or receipt verification for corporate expenses.",
        ],
        recommendedAction: "REQUEST_EVIDENCE",
        targetLedgerEntryId: candidateId,
        suggestedReason: `Request vendor invoice or receipt for reference ${ref} from Accounts Payable.`,
        requiredEvidenceTypes: ["invoice", "receipt"],
        confidence: "HIGH",
        riskLevel: "MEDIUM",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // Potential anomaly
    if (exceptions.includes("potential_anomaly")) {
      const candidateId = primaryCandidate?.id;
      const calcEvidence = caseDetail.evidence.find(
        (e) => (e.payload as any)?.calculationType === "anomaly_threshold"
      );
      const calcReason = (calcEvidence?.payload as any)?.reason;
      const thresholdFormatted = (calcEvidence?.payload as any)?.accountThreshold;
      const formattedAmount = formatCurrency(bankTx.amount);
      const rootCause = calcReason
        ? `Amount ${formattedAmount} is a statistical outlier: ${calcReason}`
        : `Amount ${formattedAmount} is a statistical outlier exceeding the account anomaly threshold${thresholdFormatted ? ` (${thresholdFormatted})` : ""}.`;

      return {
        summary: `Transaction ${bankTx.id} for ${formattedAmount} exceeds account statistical threshold.`,
        rootCause,
        reasoning: [
          `Reference and dates align with candidate ${candidateId || "record"}, but deterministic anomaly detector triggered.`,
          "High-value transaction requires controller authorization.",
        ],
        recommendedAction: "ESCALATE_TO_MANAGEMENT",
        targetLedgerEntryId: candidateId,
        suggestedReason: `Escalate ${formattedAmount} expenditure to financial controller for authorization.`,
        confidence: "HIGH",
        riskLevel: "CRITICAL",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // Exact match requiring human review (e.g. high-value policy authorization)
    if (exceptions.length === 0 && caseDetail.candidateLedgerEntries.length === 1 && primaryCandidate) {
      const candidateId = primaryCandidate.id;
      const formattedAmount = formatCurrency(bankTx.amount);
      return {
        summary: `Transaction ${bankTx.id} for ${formattedAmount} matches ledger entry ${candidateId} but requires human review under approval policy.`,
        rootCause: `Transaction amount ${formattedAmount} matches ledger entry ${candidateId} exactly; human review policy mandated for high-value authorization.`,
        reasoning: [
          `Exact amount ${formattedAmount} and reference match candidate ${candidateId}.`,
          "Policy requires controller review and explicit sign-off for high-value transactions.",
        ],
        recommendedAction: "APPROVE_MATCH",
        targetLedgerEntryId: candidateId,
        suggestedReason: `Approve matched transaction ${bankTx.id} with ledger entry ${candidateId} following controller sign-off.`,
        confidence: "HIGH",
        riskLevel: "HIGH",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // Ambiguous candidates
    return {
      summary: `Transaction ${bankTx.id} has multiple qualifying candidates [${candidateIds.join(", ")}].`,
      rootCause: "Multiple ledger entries share identical amounts, references, and dates.",
      reasoning: [
        `Candidate entries [${candidateIds.join(", ")}] compete equally.`,
        "System cannot autonomously disambiguate without reviewer judgment.",
      ],
      recommendedAction: "ESCALATE_TO_MANAGEMENT",
      suggestedReason: `Human reviewer disambiguation required to select between candidate entries [${candidateIds.join(", ")}].`,
      confidence: "MEDIUM",
      riskLevel: "HIGH",
      citedEvidenceIds: availableEvidenceIds,
    };
  }
}

/**
 * Customizable mock provider for unit testing policy validations, edge cases, and failure modes.
 */
export class CustomMockProvider implements InvestigationModelProvider {
  public readonly name = "custom_test_mock_provider";

  constructor(
    private readonly handler: (prompt: ModelPrompt) => Promise<ModelAnalysisResponse>
  ) {}

  public async analyzeCase(prompt: ModelPrompt): Promise<ModelAnalysisResponse> {
    return this.handler(prompt);
  }
}
