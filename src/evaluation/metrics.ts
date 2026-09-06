// src/evaluation/metrics.ts
// Pure, deterministic calculation of evaluation metrics from case results.
// No hardcoded values; all metrics derived strictly from actual execution counts.

import { EvaluationCase } from "../schemas/evaluation-case";
import { CaseEvaluationResult, EvaluationMetrics } from "./types";

/**
 * Calculates evaluation metrics from individual case evaluation results and ground truth cases.
 */
export function calculateEvaluationMetrics(
  caseResults: CaseEvaluationResult[],
  groundTruthCases: EvaluationCase[],
  totalDurationMs: number
): EvaluationMetrics {
  const totalCases = caseResults.length;
  const totalAgreements = caseResults.filter((r) => r.isAgreement).length;
  const totalDisagreements = totalCases - totalAgreements;
  const accuracy = totalCases > 0 ? totalAgreements / totalCases : 0;

  // 1. Eligible cases (where ground truth permits automatic resolution)
  const eligibleCases = groundTruthCases.filter((ec) => ec.expectedAutoResolutionAllowed);
  const eligibleCasesCount = eligibleCases.length;

  // Cases that were eligible AND correctly automatically resolved
  const eligibleCaseIds = new Set(eligibleCases.map((ec) => ec.id));
  const eligibleAutoResolvedCount = caseResults.filter(
    (r) => eligibleCaseIds.has(r.caseId) && r.actualAutoResolutionAllowed && r.isAgreement
  ).length;

  // Auto-reconciliation rate: eligible cases automatically resolved / all eligible cases
  const autoReconciliationRate =
    eligibleCasesCount > 0 ? eligibleAutoResolvedCount / eligibleCasesCount : 0;

  // 2. All automatic resolutions performed by the pipeline
  const allAutoResolutions = caseResults.filter((r) => r.actualAutoResolutionAllowed);
  const allAutoResolutionsCount = allAutoResolutions.length;

  // Correct automatic resolutions (pipeline auto-resolved AND ground truth agreed)
  const correctAutoResolutionsCount = allAutoResolutions.filter((r) => r.isAgreement).length;
  const incorrectAutoResolutionsCount = allAutoResolutionsCount - correctAutoResolutionsCount;

  // Precision: correct automatic resolutions / all automatic resolutions
  const matchPrecision =
    allAutoResolutionsCount > 0
      ? correctAutoResolutionsCount / allAutoResolutionsCount
      : 1.0; // Perfect precision if no spurious auto-resolutions occurred

  // False auto-close rate: incorrect automatic resolutions / all automatic resolutions
  const falseAutoCloseRate =
    allAutoResolutionsCount > 0
      ? incorrectAutoResolutionsCount / allAutoResolutionsCount
      : 0.0;

  // 3. Exception Recall: ground-truth exceptions detected / all ground-truth exceptions
  let groundTruthExceptionsCount = 0;
  let detectedExceptionsCount = 0;

  for (const ec of groundTruthCases) {
    const expected = ec.expectedExceptionTypes || [];
    groundTruthExceptionsCount += expected.length;

    const actualResult = caseResults.find((r) => r.caseId === ec.id);
    if (actualResult) {
      const actualSet = new Set(actualResult.actualExceptions);
      for (const exType of expected) {
        if (actualSet.has(exType)) {
          detectedExceptionsCount += 1;
        }
      }
    }
  }

  const exceptionRecall =
    groundTruthExceptionsCount > 0
      ? detectedExceptionsCount / groundTruthExceptionsCount
      : 1.0;

  // 4. Human Review Load: cases sent to review / all processed cases
  const humanReviewCount = caseResults.filter((r) => !r.actualAutoResolutionAllowed).length;
  const humanReviewLoad = totalCases > 0 ? humanReviewCount / totalCases : 0;

  // 5. Processing time
  const averageDurationPerCaseMs = totalCases > 0 ? totalDurationMs / totalCases : 0;

  return {
    totalCases,
    totalAgreements,
    totalDisagreements,
    accuracy,
    autoReconciliationRate,
    matchPrecision,
    exceptionRecall,
    falseAutoCloseRate,
    humanReviewLoad,
    processingTime: {
      totalDurationMs,
      averageDurationPerCaseMs,
    },
    counts: {
      eligibleCasesCount,
      eligibleAutoResolvedCount,
      allAutoResolutionsCount,
      correctAutoResolutionsCount,
      incorrectAutoResolutionsCount,
      groundTruthExceptionsCount,
      detectedExceptionsCount,
      humanReviewCount,
    },
  };
}
