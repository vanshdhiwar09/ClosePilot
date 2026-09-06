// src/evaluation/failure.ts
// Structured failure diagnosis and root-cause classification for evaluation discrepancies.

import { EvaluationCase } from "../schemas/evaluation-case";
import { ReconcileTransactionOutput } from "../reconciliation/pipeline";
import { CaseFailureAnalysis, FailureCategory } from "./types";

/**
 * Analyzes a disagreement between the predicted reconciliation outcome and ground truth.
 * Returns undefined if predicted outcome agrees fully with ground truth.
 */
export function diagnoseCaseFailure(
  ec: EvaluationCase,
  output: ReconcileTransactionOutput,
  options?: {
    statusMatch: boolean;
    candidateMatch: boolean;
    exceptionMatch: boolean;
    autoResolutionMatch: boolean;
  }
): CaseFailureAnalysis | undefined {
  const actualStatus = output.result.status;
  const expectedStatus = ec.expectedStatus;
  const actualAuto = output.autoResolutionAllowed;
  const expectedAuto = ec.expectedAutoResolutionAllowed;
  const actualExceptions = output.exceptions.map((e) => e.type);
  const expectedExceptions = ec.expectedExceptionTypes || [];

  const actualMatchedIds = (
    output.result.matchedLedgerEntryIds.length > 0
      ? output.result.matchedLedgerEntryIds
      : output.result.candidateLedgerEntryIds
  ).slice().sort();
  const expectedIds = ec.expectedLedgerEntryIds.slice().sort();

  const statusMatch = options?.statusMatch ?? (actualStatus === expectedStatus);
  const candidateMatch =
    options?.candidateMatch ??
    (actualMatchedIds.length === expectedIds.length &&
      actualMatchedIds.every((id, i) => id === expectedIds[i]));
  const exceptionMatch =
    options?.exceptionMatch ??
    (expectedExceptions.every((t) => actualExceptions.includes(t)) &&
      actualExceptions.every((t) => expectedExceptions.includes(t)));
  const autoResolutionMatch = options?.autoResolutionMatch ?? (actualAuto === expectedAuto);

  // If all aspects agree, there is no failure
  if (statusMatch && candidateMatch && exceptionMatch && autoResolutionMatch) {
    return undefined;
  }

  // Determine primary disagreement type and recommended failure category
  let disagreementType: CaseFailureAnalysis["disagreementType"];
  let recommendedCategory: FailureCategory;
  const explanations: string[] = [];

  if (!autoResolutionMatch) {
    disagreementType = "auto_close_violation";
    if (actualAuto && !expectedAuto) {
      recommendedCategory = "false_auto_close";
      explanations.push(
        "CRITICAL: Transaction was auto-reconciled when ground truth strictly requires human review."
      );
    } else {
      recommendedCategory = "unnecessary_review";
      explanations.push(
        "Transaction was unnecessarily routed to review when ground truth permits automatic resolution."
      );
    }
  } else if (!statusMatch) {
    disagreementType = "status_mismatch";
    recommendedCategory = "status_mismatch";
    explanations.push(
      `Reconciliation status mismatch: expected "${expectedStatus}", but got "${actualStatus}".`
    );
  } else if (!candidateMatch) {
    disagreementType = "candidate_mismatch";
    recommendedCategory = "wrong_candidate";
    explanations.push(
      `Candidate mismatch: expected ledger entries [${expectedIds.join(", ")}], but matched [${actualMatchedIds.join(", ")}].`
    );
  } else {
    disagreementType = "exception_mismatch";
    if (expectedExceptions.includes("duplicate") && !actualExceptions.includes("duplicate")) {
      recommendedCategory = "missed_duplicate";
    } else if (expectedExceptions.some((e) => !actualExceptions.includes(e))) {
      recommendedCategory = "missed_exception";
    } else {
      recommendedCategory = "spurious_exception";
    }
    explanations.push(
      `Exception mismatch: expected [${expectedExceptions.join(", ")}], but detected [${actualExceptions.join(", ")}].`
    );
  }

  // Extract rule trace summaries for diagnostic context
  const ruleTraceSummary = (output.matchResult?.ruleTrace || []).map(
    (step) => `[${step.passed ? "PASS" : "FAIL"}] ${step.rule}: ${step.description}`
  );

  const evidenceIds = output.evidence.map((e) => e.id);

  return {
    caseId: ec.id,
    bankTransactionId: ec.bankTransactionId,
    disagreementType,
    expectedOutcome: {
      status: ec.expectedStatus,
      autoResolutionAllowed: ec.expectedAutoResolutionAllowed,
      expectedLedgerEntryIds: ec.expectedLedgerEntryIds,
      expectedExceptionTypes: ec.expectedExceptionTypes || [],
    },
    predictedOutcome: {
      status: output.result.status,
      autoResolutionAllowed: output.autoResolutionAllowed,
      matchedLedgerEntryIds: output.result.matchedLedgerEntryIds,
      actualExceptionTypes: output.exceptions.map((e) => e.type),
    },
    explanation: explanations.join(" "),
    recommendedCategory,
    ruleTraceSummary,
    evidenceIds,
  };
}
