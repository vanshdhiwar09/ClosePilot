// tests/unit/evaluation-runner.test.ts
// Unit tests for the ClosePilot evaluation runner and report formatting.

import { describe, it, expect } from "vitest";
import { runEvaluation, formatEvaluationReport } from "../../src/evaluation/runner";
import { EvaluationRunReport } from "../../src/evaluation/types";

describe("Evaluation Runner & Report Formatter", () => {
  it("runs evaluation against the 2024.1 fixture and ground truth", () => {
    const report = runEvaluation({
      fixtureName: "month-end-reconciliation-2024.1",
      groundTruthVersion: "2024.1",
    });

    expect(report.runId).toContain("EVAL-2024.1");
    expect(report.fixtureVersion).toBe("2024.1");
    expect(report.workflowVersion).toBe("2024.1");

    // Must evaluate all 8 cases in the ground truth
    expect(report.caseResults).toHaveLength(8);
    expect(report.metrics.totalCases).toBe(8);

    // 100% agreement on baseline
    expect(report.metrics.totalAgreements).toBe(8);
    expect(report.metrics.totalDisagreements).toBe(0);
    expect(report.metrics.accuracy).toBe(1.0);

    // Specific metrics verification
    expect(report.metrics.autoReconciliationRate).toBe(1.0); // 1 eligible auto-resolved
    expect(report.metrics.matchPrecision).toBe(1.0); // 1 auto-resolution, 1 correct
    expect(report.metrics.exceptionRecall).toBe(1.0); // 6 exceptions, all detected
    expect(report.metrics.falseAutoCloseRate).toBe(0.0); // 0 false auto-closures
    expect(report.metrics.humanReviewLoad).toBe(7 / 8); // 7 cases sent to review

    // Processing time must be measurable and positive
    expect(report.metrics.processingTime.totalDurationMs).toBeGreaterThan(0);
    expect(report.metrics.processingTime.averageDurationPerCaseMs).toBeGreaterThan(0);

    // Zero failures on baseline
    expect(report.failures).toHaveLength(0);

    // Check individual case records
    for (const res of report.caseResults) {
      expect(res.isAgreement).toBe(true);
      expect(res.statusMatch).toBe(true);
      expect(res.candidateMatch).toBe(true);
      expect(res.exceptionMatch).toBe(true);
      expect(res.autoResolutionMatch).toBe(true);
      expect(res.durationMs).toBeGreaterThan(0);
      expect(res.failure).toBeUndefined();
    }
  });

  it("formats evaluation report into readable markdown with metrics and breakdown", () => {
    const report = runEvaluation();
    const formatted = formatEvaluationReport(report);

    expect(formatted).toContain("## ClosePilot Evaluation Report — Fixture 2024.1");
    expect(formatted).toContain("Auto-Reconciliation Rate");
    expect(formatted).toContain("100.0%");
    expect(formatted).toContain("Match Precision");
    expect(formatted).toContain("Exception Recall");
    expect(formatted).toContain("False Auto-Close Rate");
    expect(formatted).toContain("0.0%");
    expect(formatted).toContain("Human Review Load");
    expect(formatted).toContain("87.5%");
    expect(formatted).toContain("Zero Disagreements");
    expect(formatted).toContain("BT001");
    expect(formatted).toContain("BT008");
  });

  it("formats failure diagnostics when disagreements are present in report", () => {
    const mockReport: EvaluationRunReport = {
      runId: "TEST-RUN",
      fixtureVersion: "2024.1",
      workflowVersion: "2024.1",
      timestamp: new Date().toISOString(),
      metrics: {
        totalCases: 1,
        totalAgreements: 0,
        totalDisagreements: 1,
        accuracy: 0.0,
        autoReconciliationRate: 0.0,
        matchPrecision: 0.0,
        exceptionRecall: 0.0,
        falseAutoCloseRate: 1.0,
        humanReviewLoad: 0.0,
        processingTime: { totalDurationMs: 5, averageDurationPerCaseMs: 5 },
        counts: {
          eligibleCasesCount: 0,
          eligibleAutoResolvedCount: 0,
          allAutoResolutionsCount: 1,
          correctAutoResolutionsCount: 0,
          incorrectAutoResolutionsCount: 1,
          groundTruthExceptionsCount: 1,
          detectedExceptionsCount: 0,
          humanReviewCount: 0,
        },
      },
      caseResults: [
        {
          caseId: "EC999",
          bankTransactionId: "BT999",
          isAgreement: false,
          statusMatch: false,
          candidateMatch: true,
          exceptionMatch: false,
          autoResolutionMatch: false,
          expectedStatus: "exception",
          actualStatus: "matched",
          expectedAutoResolutionAllowed: false,
          actualAutoResolutionAllowed: true,
          expectedLedgerEntryIds: ["LE999"],
          actualMatchedLedgerEntryIds: ["LE999"],
          expectedExceptions: ["potential_anomaly"],
          actualExceptions: [],
          durationMs: 5,
        },
      ],
      failures: [
        {
          caseId: "EC999",
          bankTransactionId: "BT999",
          disagreementType: "auto_close_violation",
          expectedOutcome: {
            status: "exception",
            autoResolutionAllowed: false,
            expectedLedgerEntryIds: ["LE999"],
            expectedExceptionTypes: ["potential_anomaly"],
          },
          predictedOutcome: {
            status: "matched",
            autoResolutionAllowed: true,
            matchedLedgerEntryIds: ["LE999"],
            actualExceptionTypes: [],
          },
          explanation: "CRITICAL: Transaction was auto-reconciled when ground truth strictly requires human review.",
          recommendedCategory: "false_auto_close",
          ruleTraceSummary: ["[PASS] exact_match: Matched amount"],
          evidenceIds: ["EVD-999"],
        },
      ],
    };

    const formatted = formatEvaluationReport(mockReport);
    expect(formatted).toContain("Failure Diagnostics (1 discrepancies)");
    expect(formatted).toContain("Disagreement: Case EC999 (BT999)");
    expect(formatted).toContain("- **Recommended Category**: `false_auto_close`");
    expect(formatted).toContain("CRITICAL: Transaction was auto-reconciled");
  });
});
