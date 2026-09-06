// src/agent/investigator.ts
// Autonomous Investigation Agent for ClosePilot month-end reconciliation exceptions.
// Executes a bounded investigation loop using read-only tools and deterministic policy validation.

import {
  InvestigationResult,
  investigationResultSchema,
} from "./types";
import { ReadOnlyInvestigationToolbox } from "./tools";
import {
  DeterministicMockProvider,
  InvestigationModelProvider,
  ModelPrompt,
} from "./provider";
import { PolicyValidator } from "./policy";

export type InvestigatorOptions = {
  maxToolCalls?: number;
  modelProvider?: InvestigationModelProvider;
};

export class AutonomousInvestigator {
  private readonly provider: InvestigationModelProvider;

  constructor(options?: InvestigatorOptions) {
    this.provider = options?.modelProvider || new DeterministicMockProvider();
  }

  /**
   * Investigates a single reconciliation case deterministically.
   */
  public async investigateCase(
    caseId: string,
    toolbox: ReadOnlyInvestigationToolbox,
    options?: InvestigatorOptions
  ): Promise<InvestigationResult> {
    const maxToolCalls = options?.maxToolCalls || 10;
    const investigationId = `INV-${caseId}-${Date.now()}`;
    const investigatedAt = new Date().toISOString();

    // Step 1: Load initial case context
    const caseDetail = toolbox.get_case(caseId);
    const exceptions = caseDetail.exceptions.map((e) => e.type);

    // Step 2: Auto-resolved cases bypass deep investigation
    if (caseDetail.autoResolutionAllowed && exceptions.length === 0) {
      const result: InvestigationResult = {
        investigationId,
        caseId,
        bankTransactionId: caseDetail.bankTransaction.id,
        outcome: "SKIPPED_AUTO_RESOLVED",
        investigationSummary: `Case ${caseId} (${caseDetail.bankTransaction.id}) auto-reconciled with high confidence. Investigation skipped.`,
        rootCause: "Exact match with zero exceptions; amount, date, and normalized reference align perfectly.",
        evidenceIds: caseDetail.evidence.map((e) => e.id),
        reasoningTrace: [
          "Case evaluated as auto-reconciliation eligible.",
          "Exact match confirmed with zero active exceptions.",
          "Autonomous investigation bypassed per accounting policy.",
        ],
        recommendation: {
          action: "NO_ACTION_REQUIRED",
          suggestedReason: "Auto-reconciled exact match; no human intervention needed.",
        },
        confidence: "HIGH",
        riskLevel: "LOW",
        requiresHumanReview: false,
        policyValidation: {
          isPermitted: true,
          policyRule: "AUTO_RESOLVE_GUARD",
          policyReason: "Auto-reconciled case verified safe with zero exceptions.",
          forcedHumanReview: false,
        },
        investigatedAt,
        toolCalls: toolbox.getRecordedToolCalls(),
      };
      return investigationResultSchema.parse(result);
    }

    // Step 3: Bounded tool gathering loop
    const observations: Record<string, unknown> = {};

    // Tool Call A: Evidence verification
    if (toolbox.getRecordedToolCalls().length < maxToolCalls) {
      try {
        const evidenceItems = toolbox.get_evidence(caseId);
        observations.evidenceSummary = {
          count: evidenceItems.length,
          kinds: evidenceItems.map((e) => e.kind),
        };
      } catch (err: any) {
        observations.evidenceError = err.message;
      }
    }

    // Tool Call B: Deep inspect candidate entries and linked documents
    if (toolbox.getRecordedToolCalls().length < maxToolCalls) {
      const candidatesDetail = [];
      for (const cand of caseDetail.candidateLedgerEntries) {
        if (toolbox.getRecordedToolCalls().length >= maxToolCalls) break;
        try {
          const entryDetail = toolbox.get_ledger_entry(cand.id);
          candidatesDetail.push({
            id: cand.id,
            debit: cand.debit,
            credit: cand.credit,
            linkedDocsCount: entryDetail.linkedDocuments.length,
            linkedDocFiles: entryDetail.linkedDocuments.map((d) => d.fileName),
          });
        } catch (err: any) {
          candidatesDetail.push({ id: cand.id, error: err.message });
        }
      }
      observations.candidatesDetail = candidatesDetail;
    }

    // Tool Call C: Related transactions search for unmatched, duplicates, or ambiguous
    if (
      toolbox.getRecordedToolCalls().length < maxToolCalls &&
      (exceptions.includes("unmatched_transaction") ||
        exceptions.includes("duplicate") ||
        exceptions.includes("amount_mismatch") ||
        caseDetail.candidateLedgerEntries.length > 1)
    ) {
      try {
        const related = toolbox.get_related_transactions(caseId, {
          searchByVendor: true,
          dateWindowDays: 30,
        });
        observations.relatedTransactions = related;
      } catch (err: any) {
        observations.relatedTransactionsError = err.message;
      }
    }

    // Tool Call D: Case review history
    if (toolbox.getRecordedToolCalls().length < maxToolCalls) {
      try {
        const history = toolbox.get_case_history(caseId);
        observations.priorReviewDecisions = history.length;
      } catch {
        observations.priorReviewDecisions = 0;
      }
    }

    // Step 4: Formulate prompt and invoke model provider
    const prompt: ModelPrompt = {
      systemPrompt:
        "You are ClosePilot's Autonomous Investigation Agent for month-end account reconciliation. " +
        "Investigate reconciliation exceptions, determine root causes, assess risk, and generate actionable recommendations for human reviewers. " +
        "You operate strictly above the deterministic accounting layer and cannot directly close or alter financial records.",
      userPrompt: `Investigate reconciliation case "${caseId}" for bank transaction "${caseDetail.bankTransaction.id}" ($${caseDetail.bankTransaction.amount}). Active exceptions: [${exceptions.join(", ")}].`,
      caseDetail,
      investigationObservations: observations,
    };

    const modelResponse = await this.provider.analyzeCase(prompt);

    // Step 5: Deterministic safety policy validation
    const policy = PolicyValidator.validate(
      {
        action: modelResponse.recommendedAction,
        targetLedgerEntryId: modelResponse.targetLedgerEntryId,
        suggestedReason: modelResponse.suggestedReason,
        requiredEvidenceTypes: modelResponse.requiredEvidenceTypes,
      },
      caseDetail,
      modelResponse.citedEvidenceIds,
      modelResponse.riskLevel
    );

    // Step 6: Construct structured investigation result
    const outcome = policy.isPermitted ? "COMPLETED" : "FAILED_POLICY_CHECK";

    // If policy rejected the recommendation, sanitize recommendation to force human review safely
    let finalRecommendation = {
      action: modelResponse.recommendedAction,
      targetLedgerEntryId: modelResponse.targetLedgerEntryId,
      suggestedReason: modelResponse.suggestedReason,
      requiredEvidenceTypes: modelResponse.requiredEvidenceTypes,
    };

    if (!policy.isPermitted) {
      finalRecommendation = {
        action: "ESCALATE_TO_MANAGEMENT",
        targetLedgerEntryId: modelResponse.targetLedgerEntryId,
        suggestedReason: `Policy violation: ${policy.policyReason} Forced escalation to human reviewer.`,
        requiredEvidenceTypes: modelResponse.requiredEvidenceTypes,
      };
    }

    const result: InvestigationResult = {
      investigationId,
      caseId,
      bankTransactionId: caseDetail.bankTransaction.id,
      outcome,
      investigationSummary: modelResponse.summary,
      rootCause: modelResponse.rootCause,
      evidenceIds: modelResponse.citedEvidenceIds.filter((id) =>
        caseDetail.evidence.some((e) => e.id === id)
      ),
      reasoningTrace: modelResponse.reasoning,
      recommendation: finalRecommendation,
      confidence: modelResponse.confidence,
      riskLevel: modelResponse.riskLevel,
      requiresHumanReview: true, // Non-auto-resolved cases always require human review
      policyValidation: policy,
      investigatedAt,
      toolCalls: toolbox.getRecordedToolCalls(),
      metadata: {
        modelProvider: this.provider.name,
        exceptionsDetected: exceptions,
        autoResolutionAllowed: caseDetail.autoResolutionAllowed,
      },
    };

    return investigationResultSchema.parse(result);
  }
}
