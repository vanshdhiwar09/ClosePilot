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
import {
  InvestigationLifecycleEvent,
  InvestigationLifecycleEventType,
  InvestigationRunRecorder,
  InvestigationRunTrace,
  PolicyEvaluationRecord,
} from "../observability";

export type InvestigatorOptions = {
  maxToolCalls?: number;
  modelProvider?: InvestigationModelProvider;
  provider?: InvestigationModelProvider;
  recorder?: InvestigationRunRecorder;
};

export class AutonomousInvestigator {
  private readonly provider: InvestigationModelProvider;
  private readonly maxToolCalls: number;
  private readonly recorder?: InvestigationRunRecorder;

  constructor(options?: InvestigatorOptions) {
    this.provider =
      options?.modelProvider ||
      options?.provider ||
      new DeterministicMockProvider();
    this.maxToolCalls = options?.maxToolCalls ?? 10;
    this.recorder = options?.recorder;
  }

  /**
   * Investigates a single reconciliation case deterministically.
   */
  public async investigateCase(
    caseId: string,
    toolbox: ReadOnlyInvestigationToolbox,
    options?: InvestigatorOptions
  ): Promise<InvestigationResult> {
    const maxToolCalls = options?.maxToolCalls ?? this.maxToolCalls;
    const recorder = options?.recorder ?? this.recorder;
    const investigationId = `INV-${caseId}-${Date.now()}`;
    const investigatedAt = new Date().toISOString();

    const startTime = performance.now();
    const events: InvestigationLifecycleEvent[] = [];
    const policyEvaluations: PolicyEvaluationRecord[] = [];

    const emitEvent = (
      eventType: InvestigationLifecycleEventType,
      payload: Record<string, unknown> = {}
    ) => {
      const event: InvestigationLifecycleEvent = {
        eventId: `EVT-${caseId}-${Date.now()}-${events.length + 1}`,
        runId: investigationId,
        caseId,
        eventType,
        timestamp: new Date().toISOString(),
        payload,
      };
      events.push(event);
      if (recorder) {
        try {
          recorder.recordEvent(event);
        } catch {
          // Never break financial reconciliation on logging errors
        }
      }
    };

    const recordTraceSafe = (trace: InvestigationRunTrace) => {
      if (recorder) {
        try {
          recorder.recordTrace(trace);
        } catch {
          // Never break financial reconciliation on logging errors
        }
      }
    };

    try {
      emitEvent("investigation_started", { caseId });

    // Step 1: Load initial case context
    emitEvent("tool_called", { toolName: "get_case", caseId });
    const caseDetail = toolbox.get_case(caseId);
    emitEvent("tool_completed", { toolName: "get_case", caseId });
    const exceptions = caseDetail.exceptions.map((e) => e.type);

    // Step 2: Auto-resolved cases bypass deep investigation
    if (caseDetail.autoResolutionAllowed && exceptions.length === 0) {
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
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
        metadata: {
          modelProvider: this.provider.name,
          durationMs,
          autoResolutionAllowed: true,
        },
      };

      emitEvent("investigation_skipped", {
        caseId,
        bankTransactionId: caseDetail.bankTransaction.id,
        reason: "Auto-reconciled with zero exceptions; deep investigation bypassed per accounting policy.",
      });

      emitEvent("investigation_completed", {
        caseId,
        outcome: "SKIPPED_AUTO_RESOLVED",
        durationMs,
      });

      recordTraceSafe({
        runId: investigationId,
        caseId,
        bankTransactionId: caseDetail.bankTransaction.id,
        startTime: investigatedAt,
        endTime: new Date().toISOString(),
        durationMs,
        provider: this.provider.name,
        outcome: "SKIPPED_AUTO_RESOLVED",
        recommendation: result.recommendation,
        confidence: "HIGH",
        riskLevel: "LOW",
        requiresHumanReview: false,
        toolCalls: toolbox.getRecordedToolCalls(),
        policyEvaluations: [
          {
            policyRule: "AUTO_RESOLVE_GUARD",
            isPermitted: true,
            policyReason: "Auto-reconciled case verified safe with zero exceptions.",
            forcedHumanReview: false,
            timestamp: investigatedAt,
          },
        ],
        evidenceIds: result.evidenceIds,
        events: [...events],
        metadata: result.metadata || {},
      });

      return investigationResultSchema.parse(result);
    }

    // Step 3: Bounded tool gathering loop
    const observations: Record<string, unknown> = {};

    // Tool Call A: Evidence verification
    if (toolbox.getRecordedToolCalls().length < maxToolCalls) {
      try {
        emitEvent("tool_called", { toolName: "get_evidence", caseId });
        const evidenceItems = toolbox.get_evidence(caseId);
        emitEvent("tool_completed", { toolName: "get_evidence", count: evidenceItems.length });
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
          emitEvent("tool_called", { toolName: "get_ledger_entry", ledgerEntryId: cand.id });
          const entryDetail = toolbox.get_ledger_entry(cand.id);
          emitEvent("tool_completed", { toolName: "get_ledger_entry", ledgerEntryId: cand.id });
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
        emitEvent("tool_called", { toolName: "get_related_transactions", caseId });
        const related = toolbox.get_related_transactions(caseId, {
          searchByVendor: true,
          dateWindowDays: 30,
        });
        emitEvent("tool_completed", { toolName: "get_related_transactions", matchCount: related.relatedLedgerCount });
        observations.relatedTransactions = related;
      } catch (err: any) {
        observations.relatedTransactionsError = err.message;
      }
    }

    // Tool Call D: Case review history
    if (toolbox.getRecordedToolCalls().length < maxToolCalls) {
      try {
        emitEvent("tool_called", { toolName: "get_case_history", caseId });
        const history = toolbox.get_case_history(caseId);
        emitEvent("tool_completed", { toolName: "get_case_history", decisionsCount: history.length });
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
        targetLedgerEntryId: modelResponse.targetLedgerEntryId || undefined,
        suggestedReason: modelResponse.suggestedReason,
        requiredEvidenceTypes: modelResponse.requiredEvidenceTypes || undefined,
      },
      caseDetail,
      modelResponse.citedEvidenceIds,
      modelResponse.riskLevel
    );

    policyEvaluations.push({
      policyRule: policy.policyRule,
      isPermitted: policy.isPermitted,
      policyReason: policy.policyReason,
      forcedHumanReview: policy.forcedHumanReview,
      timestamp: new Date().toISOString(),
      context: {
        exceptions,
        riskLevel: modelResponse.riskLevel,
        modelAction: modelResponse.recommendedAction,
      },
    });

    emitEvent("policy_evaluated", {
      policyRule: policy.policyRule,
      isPermitted: policy.isPermitted,
      policyReason: policy.policyReason,
      forcedHumanReview: policy.forcedHumanReview,
    });

    // Step 6: Construct structured investigation result
    const outcome = policy.isPermitted ? "COMPLETED" : "FAILED_POLICY_CHECK";

    // If policy rejected the recommendation, sanitize recommendation to force human review safely
    const rawModelRecommendation = {
      action: modelResponse.recommendedAction,
      targetLedgerEntryId: modelResponse.targetLedgerEntryId || undefined,
      suggestedReason: modelResponse.suggestedReason,
      requiredEvidenceTypes: modelResponse.requiredEvidenceTypes || undefined,
    };

    let finalRecommendation = { ...rawModelRecommendation };

    if (!policy.isPermitted) {
      finalRecommendation = {
        action: "ESCALATE_TO_MANAGEMENT",
        targetLedgerEntryId: modelResponse.targetLedgerEntryId || undefined,
        suggestedReason: `Policy violation: ${policy.policyReason} Forced escalation to human reviewer.`,
        requiredEvidenceTypes: modelResponse.requiredEvidenceTypes || undefined,
      };
    }

    emitEvent("recommendation_generated", {
      action: finalRecommendation.action,
      suggestedReason: finalRecommendation.suggestedReason,
      confidence: modelResponse.confidence,
      riskLevel: modelResponse.riskLevel,
      isPermitted: policy.isPermitted,
      rawModelAction: rawModelRecommendation.action,
    });

    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

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
      rawModelRecommendation,
      confidence: modelResponse.confidence,
      riskLevel: modelResponse.riskLevel,
      requiresHumanReview: true, // Non-auto-resolved cases always require human review
      policyValidation: policy,
      investigatedAt,
      toolCalls: toolbox.getRecordedToolCalls(),
      metadata: {
        modelProvider: (modelResponse as any)?._modelProvider || this.provider.name,
        exceptionsDetected: exceptions,
        autoResolutionAllowed: caseDetail.autoResolutionAllowed,
        durationMs,
      },
    };

    emitEvent("investigation_completed", {
      outcome,
      durationMs,
      requiresHumanReview: true,
    });

    const effectiveProvider = (modelResponse as any)?._modelProvider || this.provider.name;

    recordTraceSafe({
      runId: investigationId,
      caseId,
      bankTransactionId: caseDetail.bankTransaction.id,
      startTime: investigatedAt,
      endTime: new Date().toISOString(),
      durationMs,
      provider: effectiveProvider,
      outcome,
      recommendation: finalRecommendation,
      rawModelRecommendation:
        rawModelRecommendation.action !== finalRecommendation.action
          ? rawModelRecommendation
          : undefined,
      confidence: modelResponse.confidence,
      riskLevel: modelResponse.riskLevel,
      requiresHumanReview: true,
      toolCalls: toolbox.getRecordedToolCalls(),
      policyEvaluations,
      evidenceIds: result.evidenceIds,
      events: [...events],
      metadata: result.metadata || {},
    });

    return investigationResultSchema.parse(result);
  } catch (err: any) {
    const errorDurationMs = Math.round((performance.now() - startTime) * 100) / 100;
    emitEvent("investigation_failed", {
      error: err.message,
      stack: err.stack,
    });

    recordTraceSafe({
      runId: investigationId,
      caseId,
      bankTransactionId: "unknown",
      startTime: investigatedAt,
      endTime: new Date().toISOString(),
      durationMs: errorDurationMs,
      provider: this.provider.name,
      outcome: "FAILED_EXECUTION",
      recommendation: {
        action: "ESCALATE_TO_MANAGEMENT",
        suggestedReason: `Investigation execution failed: ${err.message}`,
      },
      confidence: "LOW",
      riskLevel: "CRITICAL",
      requiresHumanReview: true,
      toolCalls: toolbox.getRecordedToolCalls(),
      policyEvaluations,
      evidenceIds: [],
      events: [...events],
      error: {
        message: err.message,
        stack: err.stack,
      },
      metadata: {
        error: err.message,
        durationMs: errorDurationMs,
      },
    });

    throw err;
  }
}
}
