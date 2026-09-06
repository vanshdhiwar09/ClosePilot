// src/agent/evaluation.ts
// Evaluation system for measuring AutonomousInvestigator performance against ground truth.
// Exposes calculated metrics without hardcoding, distinguishing agent investigation quality
// from deterministic reconciliation correctness and human review outcomes.

import { loadFixture, loadGroundTruth } from "../schemas/fixture-loader";
import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { SupportingDocument } from "../schemas/supporting-document";
import { EvaluationCase } from "../schemas/evaluation-case";
import {
  initializePipelineContext,
  reconcileBankTransaction,
  ReconcileTransactionOutput,
} from "../reconciliation/pipeline";
import { AutonomousInvestigator, InvestigatorOptions } from "./investigator";
import {
  AgentEvaluationMetrics,
  InvestigationResult,
  RecommendationAction,
} from "./types";
import { InvestigationContext, ReadOnlyInvestigationToolbox } from "./tools";

export type AgentCaseEvaluation = {
  caseId: string;
  bankTransactionId: string;
  investigationOutcome: string;
  recommendationAction: RecommendationAction;
  expectedOutcome: string;
  isAccurate: boolean;
  policyPermitted: boolean;
  forcedHumanReview: boolean;
  citationsValid: boolean;
  toolCallCount: number;
  durationMs: number;
};

export type AgentEvaluationReport = {
  fixtureVersion: string;
  evaluatedAt: string;
  metrics: AgentEvaluationMetrics;
  caseEvaluations: AgentCaseEvaluation[];
};

/**
 * Checks whether an agent recommendation aligns with ground truth expectations.
 * Does NOT conflate recommendation accuracy with accounting correctness.
 */
export function isRecommendationAccurate(
  action: RecommendationAction,
  gt: EvaluationCase
): boolean {
  if (gt.expectedAutoResolutionAllowed && gt.expectedStatus === "matched") {
    return action === "NO_ACTION_REQUIRED" || action === "APPROVE_MATCH";
  }

  const exceptions = gt.expectedExceptionTypes || [];

  if (exceptions.includes("potential_anomaly")) {
    return action === "ESCALATE_TO_MANAGEMENT";
  }

  if (exceptions.includes("missing_documentation")) {
    return action === "REQUEST_EVIDENCE";
  }

  if (exceptions.includes("timing_difference")) {
    return action === "APPROVE_MATCH";
  }

  if (exceptions.includes("duplicate")) {
    return action === "APPROVE_MATCH" || action === "REJECT_MATCH";
  }

  if (exceptions.includes("amount_mismatch")) {
    return (
      action === "PRICE_ADJUSTMENT_REQUIRED" ||
      action === "REQUEST_EVIDENCE" ||
      action === "REJECT_MATCH"
    );
  }

  if (exceptions.includes("unmatched_transaction")) {
    return action === "MANUAL_ENTRY_REQUIRED" || action === "REJECT_MATCH";
  }

  if (gt.expectedStatus === "review_required") {
    return (
      action === "ESCALATE_TO_MANAGEMENT" ||
      action === "REQUEST_EVIDENCE" ||
      action === "APPROVE_MATCH"
    );
  }

  return false;
}

/**
 * Derives calculated agent evaluation metrics from actual investigation results.
 * All calculations are strictly derived from real observation counts without hardcoding.
 */
export function calculateAgentMetrics(
  results: InvestigationResult[],
  groundTruthCases: EvaluationCase[],
  evidenceMap?: Map<string, string[]>
): { metrics: AgentEvaluationMetrics; caseEvaluations: AgentCaseEvaluation[] } {
  const totalCases = results.length;
  if (totalCases === 0) {
    return {
      metrics: {
        totalCases: 0,
        investigatedCases: 0,
        skippedAutoResolvedCases: 0,
        investigationCompletionRate: 0,
        recommendationAccuracy: 0,
        evidenceCitationValidity: 0,
        policyViolationRate: 0,
        forcedHumanReviewRate: 0,
        averageInvestigationTimeMs: 0,
        averageToolCallsPerInvestigation: 0,
        counts: {
          totalToolCalls: 0,
          totalEvidenceCitations: 0,
          validEvidenceCitations: 0,
          policyViolationsCount: 0,
          forcedHumanReviewCount: 0,
          recommendationMatchesCount: 0,
        },
      },
      caseEvaluations: [],
    };
  }

  let investigatedCases = 0;
  let skippedAutoResolvedCases = 0;
  let completedCount = 0;
  let accurateCount = 0;
  let policyViolationCount = 0;
  let forcedHumanReviewCount = 0;
  let totalDurationMs = 0;
  let totalToolCalls = 0;
  let totalEvidenceCitations = 0;
  let validEvidenceCitations = 0;

  const caseEvaluations: AgentCaseEvaluation[] = [];

  const gtMap = new Map<string, EvaluationCase>();
  for (const gt of groundTruthCases) {
    gtMap.set(gt.id, gt);
    gtMap.set(gt.bankTransactionId, gt);
  }

  for (const inv of results) {
    const duration =
      typeof inv.metadata?.durationMs === "number"
        ? inv.metadata.durationMs
        : inv.toolCalls.reduce((s, t) => s + t.durationMs, 0);

    totalDurationMs += duration;
    totalToolCalls += inv.toolCalls.length;

    if (inv.outcome === "SKIPPED_AUTO_RESOLVED") {
      skippedAutoResolvedCases++;
    } else {
      investigatedCases++;
    }

    if (inv.outcome === "COMPLETED") {
      completedCount++;
    }

    if (!inv.policyValidation.isPermitted) {
      policyViolationCount++;
    }
    if (inv.policyValidation.forcedHumanReview) {
      forcedHumanReviewCount++;
    }

    // Ground truth comparison
    const gt = gtMap.get(inv.caseId) || gtMap.get(inv.bankTransactionId);
    let isAccurate = false;
    let expectedOutcome = "unknown";

    if (gt) {
      expectedOutcome =
        gt.expectedExceptionTypes && gt.expectedExceptionTypes.length > 0
          ? gt.expectedExceptionTypes.join(", ")
          : gt.expectedStatus;
      isAccurate = isRecommendationAccurate(inv.recommendation.action, gt);
      if (isAccurate && inv.outcome !== "SKIPPED_AUTO_RESOLVED") {
        accurateCount++;
      }
    }

    // Evidence citation validity
    const citedIds = inv.evidenceIds || [];
    const availableEvidence = evidenceMap?.get(inv.caseId) || [];
    let caseCitationsValid = true;

    for (const citedId of citedIds) {
      totalEvidenceCitations++;
      if (evidenceMap) {
        if (availableEvidence.includes(citedId)) {
          validEvidenceCitations++;
        } else {
          caseCitationsValid = false;
        }
      } else {
        validEvidenceCitations++;
      }
    }

    caseEvaluations.push({
      caseId: inv.caseId,
      bankTransactionId: inv.bankTransactionId,
      investigationOutcome: inv.outcome,
      recommendationAction: inv.recommendation.action,
      expectedOutcome,
      isAccurate,
      policyPermitted: inv.policyValidation.isPermitted,
      forcedHumanReview: inv.policyValidation.forcedHumanReview,
      citationsValid: caseCitationsValid,
      toolCallCount: inv.toolCalls.length,
      durationMs: duration,
    });
  }

  const denominator = investigatedCases > 0 ? investigatedCases : 1;

  const investigationCompletionRate =
    investigatedCases > 0
      ? Math.round((completedCount / investigatedCases) * 1000) / 1000
      : 1.0;
  const recommendationAccuracy =
    investigatedCases > 0
      ? Math.round((accurateCount / investigatedCases) * 1000) / 1000
      : 1.0;
  const evidenceCitationValidity =
    totalEvidenceCitations > 0
      ? Math.round((validEvidenceCitations / totalEvidenceCitations) * 1000) / 1000
      : 1.0;
  const policyViolationRate =
    Math.round((policyViolationCount / denominator) * 1000) / 1000;
  const forcedHumanReviewRate =
    Math.round((forcedHumanReviewCount / denominator) * 1000) / 1000;
  const averageInvestigationTimeMs =
    Math.round((totalDurationMs / denominator) * 10) / 10;
  const averageToolCallsPerInvestigation =
    Math.round((totalToolCalls / denominator) * 10) / 10;

  const metrics: AgentEvaluationMetrics = {
    totalCases,
    investigatedCases,
    skippedAutoResolvedCases,
    investigationCompletionRate,
    recommendationAccuracy,
    evidenceCitationValidity,
    policyViolationRate,
    forcedHumanReviewRate,
    averageInvestigationTimeMs,
    averageToolCallsPerInvestigation,
    counts: {
      totalToolCalls,
      totalEvidenceCitations,
      validEvidenceCitations,
      policyViolationsCount: policyViolationCount,
      forcedHumanReviewCount: forcedHumanReviewCount,
      recommendationMatchesCount: accurateCount,
    },
  };

  return { metrics, caseEvaluations };
}

/**
 * Runs an agent evaluation on a fixture against ground truth.
 */
export async function evaluateAgentOnFixture(options?: {
  fixtureName?: string;
  groundTruthVersion?: string;
  investigatorOptions?: InvestigatorOptions;
  investigateAutoResolved?: boolean;
}): Promise<AgentEvaluationReport> {
  const fixtureName = options?.fixtureName || "month-end-reconciliation-2024.1";
  const groundTruthVersion = options?.groundTruthVersion || "2024.1";
  const investigateAutoResolved = options?.investigateAutoResolved ?? true;

  const fixture = loadFixture(fixtureName) as any;
  const groundTruth = loadGroundTruth(groundTruthVersion) as any;

  const bankTransactions: BankTransaction[] = fixture.bankTransactions;
  const ledgerEntries: LedgerEntry[] = fixture.ledgerEntries;
  const documents: SupportingDocument[] = fixture.documents;
  const evaluationCases: EvaluationCase[] = groundTruth.evaluationCases;

  const pipelineCtx = initializePipelineContext(bankTransactions, ledgerEntries);
  const reconcileOutputs = new Map<string, ReconcileTransactionOutput>();
  const caseBankTxMap = new Map<string, string>();
  const evidenceMap = new Map<string, string[]>();

  for (const ec of evaluationCases) {
    const bankTx = bankTransactions.find((b) => b.id === ec.bankTransactionId);
    if (!bankTx) continue;

    const output = reconcileBankTransaction(
      bankTx,
      ledgerEntries,
      documents,
      pipelineCtx
    );
    reconcileOutputs.set(bankTx.id, output);
    caseBankTxMap.set(ec.id, bankTx.id);
    evidenceMap.set(
      ec.id,
      (output.evidence || []).map((e) => e.id)
    );
  }

  const context: InvestigationContext = {
    bankTransactions,
    ledgerEntries,
    documents,
    reconcileOutputs,
    caseBankTxMap,
  };

  const investigator = new AutonomousInvestigator(options?.investigatorOptions);
  const results: InvestigationResult[] = [];

  for (const ec of evaluationCases) {
    const bankTxId = caseBankTxMap.get(ec.id);
    const output = bankTxId ? reconcileOutputs.get(bankTxId) : undefined;

    const isAutoResolved =
      output?.result.status === "matched" &&
      output.autoResolutionAllowed &&
      output.exceptions.length === 0;

    if (isAutoResolved && !investigateAutoResolved) {
      continue;
    }

    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const res = await investigator.investigateCase(ec.id, toolbox);
    results.push(res);
  }

  const { metrics, caseEvaluations } = calculateAgentMetrics(
    results,
    evaluationCases,
    evidenceMap
  );

  return {
    fixtureVersion: groundTruthVersion,
    evaluatedAt: new Date().toISOString(),
    metrics,
    caseEvaluations,
  };
}
