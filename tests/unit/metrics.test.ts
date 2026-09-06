// tests/unit/metrics.test.ts
// Unit tests for pure deterministic evaluation metrics calculation.

import { describe, it, expect } from "vitest";
import { calculateEvaluationMetrics } from "../../src/evaluation/metrics";
import { CaseEvaluationResult } from "../../src/evaluation/types";
import { EvaluationCase } from "../../src/schemas/evaluation-case";

describe("Deterministic Evaluation Metrics Calculations", () => {
  const createMockCase = (id: string, autoAllowed: boolean, exceptions: string[] = []): EvaluationCase => ({
    id,
    fixtureVersion: "2024.1",
    bankTransactionId: `BT-${id}`,
    expectedLedgerEntryIds: [`LE-${id}`],
    expectedStatus: autoAllowed ? "matched" : "exception",
    expectedExceptionTypes: exceptions as any,
    expectedAutoResolutionAllowed: autoAllowed,
  });

  const createMockResult = (
    caseId: string,
    isAgreement: boolean,
    autoAllowed: boolean,
    actualExceptions: string[] = []
  ): CaseEvaluationResult => ({
    caseId,
    bankTransactionId: `BT-${caseId}`,
    isAgreement,
    statusMatch: isAgreement,
    candidateMatch: isAgreement,
    exceptionMatch: isAgreement,
    autoResolutionMatch: isAgreement,
    expectedStatus: "matched",
    actualStatus: isAgreement ? "matched" : "exception",
    expectedAutoResolutionAllowed: autoAllowed,
    actualAutoResolutionAllowed: autoAllowed,
    expectedLedgerEntryIds: [`LE-${caseId}`],
    actualMatchedLedgerEntryIds: [`LE-${caseId}`],
    expectedExceptions: [],
    actualExceptions,
    durationMs: 10,
  });

  it("calculates 100% metrics on perfect execution", () => {
    const cases = [
      createMockCase("C1", true, []), // eligible auto-closed
      createMockCase("C2", false, ["amount_mismatch"]), // review/exception
    ];

    const results: CaseEvaluationResult[] = [
      createMockResult("C1", true, true, []),
      createMockResult("C2", true, false, ["amount_mismatch"]),
    ];

    const metrics = calculateEvaluationMetrics(results, cases, 20);

    expect(metrics.totalCases).toBe(2);
    expect(metrics.totalAgreements).toBe(2);
    expect(metrics.totalDisagreements).toBe(0);
    expect(metrics.accuracy).toBe(1.0);
    expect(metrics.autoReconciliationRate).toBe(1.0); // 1/1 eligible resolved
    expect(metrics.matchPrecision).toBe(1.0); // 1/1 correct auto-resolution
    expect(metrics.falseAutoCloseRate).toBe(0.0); // 0 false auto-closures
    expect(metrics.exceptionRecall).toBe(1.0); // 1/1 exception detected
    expect(metrics.humanReviewLoad).toBe(0.5); // 1/2 cases sent to review
    expect(metrics.processingTime.totalDurationMs).toBe(20);
    expect(metrics.processingTime.averageDurationPerCaseMs).toBe(10);
  });

  it("calculates false auto-close rate and lower precision when inappropriate auto-closure occurs", () => {
    const cases = [
      createMockCase("C1", true, []),
      createMockCase("C2", false, ["potential_anomaly"]), // ground truth requires review
    ];

    // C2 was falsely auto-closed by a flawed pipeline!
    const results: CaseEvaluationResult[] = [
      createMockResult("C1", true, true, []),
      createMockResult("C2", false, true, []), // falsely auto-closed!
    ];

    const metrics = calculateEvaluationMetrics(results, cases, 20);

    // 2 total auto-closures, but only 1 was correct
    expect(metrics.counts.allAutoResolutionsCount).toBe(2);
    expect(metrics.counts.correctAutoResolutionsCount).toBe(1);
    expect(metrics.counts.incorrectAutoResolutionsCount).toBe(1);
    expect(metrics.matchPrecision).toBe(0.5); // 1 / 2 = 50%
    expect(metrics.falseAutoCloseRate).toBe(0.5); // 1 / 2 = 50%
  });

  it("calculates exception recall accurately when an expected exception is missed", () => {
    const cases = [
      createMockCase("C1", false, ["duplicate", "missing_documentation"]), // 2 expected exceptions
    ];

    // Pipeline only detected "duplicate", missed "missing_documentation"
    const results: CaseEvaluationResult[] = [
      createMockResult("C1", false, false, ["duplicate"]),
    ];

    const metrics = calculateEvaluationMetrics(results, cases, 10);

    expect(metrics.counts.groundTruthExceptionsCount).toBe(2);
    expect(metrics.counts.detectedExceptionsCount).toBe(1);
    expect(metrics.exceptionRecall).toBe(0.5); // 1 / 2 = 50%
  });

  it("handles edge cases with 0 eligible cases or 0 auto-closures gracefully", () => {
    const cases = [createMockCase("C1", false, ["unmatched_transaction"])];
    const results = [createMockResult("C1", true, false, ["unmatched_transaction"])];

    const metrics = calculateEvaluationMetrics(results, cases, 5);

    expect(metrics.autoReconciliationRate).toBe(0); // 0 eligible cases
    expect(metrics.matchPrecision).toBe(1.0); // No false positives occurred
    expect(metrics.falseAutoCloseRate).toBe(0.0);
    expect(metrics.humanReviewLoad).toBe(1.0);
  });
});
