// src/agent/provider.ts
// Model provider abstraction and deterministic benchmark provider for ClosePilot investigation.
// Pluggable interface: isolates LLM/model access behind an explicit contract without hardcoding vendor SDKs or secrets.

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
};

export interface InvestigationModelProvider {
  readonly name: string;
  analyzeCase(prompt: ModelPrompt): Promise<ModelAnalysisResponse>;
}

/**
 * Deterministic model provider grounded in accounting domain rules and fixture labels.
 * Produces structured analysis responses without external network calls.
 */
export class DeterministicMockProvider implements InvestigationModelProvider {
  public readonly name = "deterministic_accounting_model_v1";

  public async analyzeCase(prompt: ModelPrompt): Promise<ModelAnalysisResponse> {
    const { caseDetail } = prompt;
    const exceptions = caseDetail.exceptions.map((e) => e.type);
    const availableEvidenceIds = caseDetail.evidence.map((e) => e.id);

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

    // BT002: Unmatched transaction
    if (exceptions.includes("unmatched_transaction")) {
      return {
        summary: `Bank transaction ${caseDetail.bankTransaction.id} ($${caseDetail.bankTransaction.amount}) has no matching ledger entry.`,
        rootCause: `No candidate entry found in account ${caseDetail.bankTransaction.accountId} matching counterparty ${caseDetail.bankTransaction.counterparty || caseDetail.bankTransaction.description}.`,
        reasoning: [
          "Scanned all ledger entries in account; zero matching records found.",
          "Rule account_currency_filter failed to find any candidate.",
        ],
        recommendedAction: "MANUAL_ENTRY_REQUIRED",
        suggestedReason: "Book manual adjusting ledger entry or contact counterparty to confirm payment allocation.",
        confidence: "HIGH",
        riskLevel: "HIGH",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // BT003: Amount mismatch
    if (exceptions.includes("amount_mismatch")) {
      const candidateId = caseDetail.candidateLedgerEntries[0]?.id;
      return {
        summary: `Bank transaction ${caseDetail.bankTransaction.id} ($${caseDetail.bankTransaction.amount}) has an amount discrepancy against candidate ${candidateId}.`,
        rootCause: `Reference and dates match, but bank amount ($${caseDetail.bankTransaction.amount}) differs from ledger debit/credit ($${caseDetail.reconciliationResult.amountDifference} variance).`,
        reasoning: [
          "Candidate matches on reference INV-003 and date window.",
          `Deterministic variance calculated: $${caseDetail.reconciliationResult.amountDifference}.`,
        ],
        recommendedAction: "PRICE_ADJUSTMENT_REQUIRED",
        targetLedgerEntryId: candidateId,
        suggestedReason: "Investigate $250.00 price discrepancy with vendor and book credit memo.",
        confidence: "HIGH",
        riskLevel: "MEDIUM",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // BT004: Timing difference
    if (exceptions.includes("timing_difference")) {
      const candidateId = caseDetail.candidateLedgerEntries[0]?.id;
      return {
        summary: `Bank transaction ${caseDetail.bankTransaction.id} matches candidate ${candidateId} outside the exact same-day window.`,
        rootCause: "Bank transaction date and ledger entry date differ by 1 day (timing clearance difference).",
        reasoning: [
          "Exact amount and normalized reference match candidate LE001.",
          "Timing difference of 1 day is within policy clearing tolerance.",
        ],
        recommendedAction: "APPROVE_MATCH",
        targetLedgerEntryId: candidateId,
        suggestedReason: "1-day timing clearance difference is acceptable under month-end reconciliation policy.",
        confidence: "HIGH",
        riskLevel: "LOW",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // BT005: Duplicate candidates
    if (exceptions.includes("duplicate")) {
      const candidateIds = caseDetail.candidateLedgerEntries.map((e) => e.id);
      return {
        summary: `Bank transaction ${caseDetail.bankTransaction.id} matched multiple duplicate candidates [${candidateIds.join(", ")}].`,
        rootCause: "Identical amount and normalized reference posted multiple times in general ledger (duplicate cluster).",
        reasoning: [
          "Deterministic duplicate detector identified LE005 and LE006 as a duplicate cluster.",
          "One ledger entry must be matched and the duplicate voided in the subledger.",
        ],
        recommendedAction: "APPROVE_MATCH",
        targetLedgerEntryId: candidateIds[0] || "LE005",
        suggestedReason: "Approve match with primary entry LE005 and void duplicate subledger entry LE006.",
        confidence: "HIGH",
        riskLevel: "MEDIUM",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // BT006: Missing documentation
    if (exceptions.includes("missing_documentation")) {
      const candidateId = caseDetail.candidateLedgerEntries[0]?.id;
      return {
        summary: `Candidate entry ${candidateId} matching bank transaction ${caseDetail.bankTransaction.id} lacks required supporting documentation.`,
        rootCause: "Ledger entry LE004 has no linked supporting document or valid invoice metadata.",
        reasoning: [
          "Amount and reference match candidate LE004.",
          "Audit policy requires invoice or receipt verification for corporate expenses.",
        ],
        recommendedAction: "REQUEST_EVIDENCE",
        targetLedgerEntryId: candidateId,
        suggestedReason: "Request vendor invoice or receipt REC-2024-003 from Accounts Payable.",
        requiredEvidenceTypes: ["invoice", "receipt"],
        confidence: "HIGH",
        riskLevel: "MEDIUM",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // BT007: Potential anomaly
    if (exceptions.includes("potential_anomaly")) {
      const candidateId = caseDetail.candidateLedgerEntries[0]?.id;
      const calcEvidence = caseDetail.evidence.find(
        (e) => (e.payload as any)?.calculationType === "anomaly_threshold"
      );
      const calcReason = (calcEvidence?.payload as any)?.reason;
      const rootCause = calcReason
        ? `Amount $15,000.00 is a statistical outlier: ${calcReason}`
        : "Amount $15,000.00 is a statistical outlier exceeding the account anomaly threshold ($6,250.00, computed as 5x median $1,250.00).";

      return {
        summary: `Transaction ${caseDetail.bankTransaction.id} for $${caseDetail.bankTransaction.amount} exceeds account statistical threshold.`,
        rootCause,
        reasoning: [
          "Reference and dates align with entry LE009, but deterministic anomaly detector triggered.",
          "High-value transaction requires controller authorization.",
        ],
        recommendedAction: "ESCALATE_TO_MANAGEMENT",
        targetLedgerEntryId: candidateId,
        suggestedReason: "Escalate $15,000.00 capital equipment expenditure to financial controller for authorization.",
        confidence: "HIGH",
        riskLevel: "CRITICAL",
        citedEvidenceIds: availableEvidenceIds,
      };
    }

    // BT008: Ambiguous candidates
    const candidateIds = caseDetail.candidateLedgerEntries.map((e) => e.id);
    return {
      summary: `Transaction ${caseDetail.bankTransaction.id} has multiple qualifying candidates [${candidateIds.join(", ")}].`,
      rootCause: "Multiple ledger entries share identical amounts, references, and dates.",
      reasoning: [
        "Candidate entries LE008a and LE008b compete equally.",
        "System cannot autonomously disambiguate without reviewer judgment.",
      ],
      recommendedAction: "ESCALATE_TO_MANAGEMENT",
      suggestedReason: "Human reviewer disambiguation required to select between candidate entries LE008a and LE008b.",
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
