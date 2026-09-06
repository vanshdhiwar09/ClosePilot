// src/observability/metrics.ts
// Calculates observability metrics from recorded investigation run traces.
// Completely separated from financial reconciliation accuracy metrics.

import { InvestigationRunTrace, ObservabilityMetrics } from "./types";

/**
 * Calculates operational metrics across a collection of investigation traces.
 */
export function calculateObservabilityMetrics(
  traces: ReadonlyArray<InvestigationRunTrace>
): ObservabilityMetrics {
  const totalRuns = traces.length;
  if (totalRuns === 0) {
    return {
      totalRuns: 0,
      completedRuns: 0,
      skippedRuns: 0,
      failedRuns: 0,
      averageDurationMs: 0,
      averageToolCalls: 0,
      policyEvaluationsCount: 0,
      policyBlocksCount: 0,
      forcedHumanReviewCount: 0,
    };
  }

  let completedRuns = 0;
  let skippedRuns = 0;
  let failedRuns = 0;
  let totalDurationMs = 0;
  let totalToolCalls = 0;
  let policyEvaluationsCount = 0;
  let policyBlocksCount = 0;
  let forcedHumanReviewCount = 0;

  for (const trace of traces) {
    totalDurationMs += trace.durationMs;
    totalToolCalls += trace.toolCalls.length;
    policyEvaluationsCount += trace.policyEvaluations.length;

    for (const pe of trace.policyEvaluations) {
      if (!pe.isPermitted) {
        policyBlocksCount++;
      }
      if (pe.forcedHumanReview) {
        forcedHumanReviewCount++;
      }
    }

    if (trace.outcome === "COMPLETED") {
      completedRuns++;
    } else if (trace.outcome === "SKIPPED_AUTO_RESOLVED") {
      skippedRuns++;
    } else if (
      trace.outcome === "FAILED_POLICY_CHECK" ||
      trace.outcome === "FAILED_EXECUTION"
    ) {
      failedRuns++;
    }
  }

  const averageDurationMs = Math.round((totalDurationMs / totalRuns) * 10) / 10;
  const averageToolCalls = Math.round((totalToolCalls / totalRuns) * 10) / 10;

  return {
    totalRuns,
    completedRuns,
    skippedRuns,
    failedRuns,
    averageDurationMs,
    averageToolCalls,
    policyEvaluationsCount,
    policyBlocksCount,
    forcedHumanReviewCount,
  };
}
