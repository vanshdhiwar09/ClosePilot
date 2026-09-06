// tests/unit/agent-evaluation.test.ts
// Tests for Phase 5B Agent Evaluation layer and calculated metrics.

import { describe, it, expect } from "vitest";
import {
  calculateAgentMetrics,
  evaluateAgentOnFixture,
  isRecommendationAccurate,
} from "../../src/agent/evaluation";
import { loadGroundTruth } from "../../src/schemas/fixture-loader";

describe("Phase 5B Agent Evaluation", () => {
  it("evaluates agent performance against fixture 2024.1 with calculated metrics", async () => {
    const report = await evaluateAgentOnFixture({
      fixtureName: "month-end-reconciliation-2024.1",
      groundTruthVersion: "2024.1",
      investigateAutoResolved: true,
    });

    const m = report.metrics;

    // Verify all 7 required metrics exist as numbers
    expect(typeof m.investigationCompletionRate).toBe("number");
    expect(typeof m.recommendationAccuracy).toBe("number");
    expect(typeof m.evidenceCitationValidity).toBe("number");
    expect(typeof m.policyViolationRate).toBe("number");
    expect(typeof m.forcedHumanReviewRate).toBe("number");
    expect(typeof m.averageInvestigationTimeMs).toBe("number");
    expect(typeof m.averageToolCallsPerInvestigation).toBe("number");

    // Total cases in fixture 2024.1
    expect(m.totalCases).toBe(8);
    expect(m.investigatedCases).toBe(7);
    expect(m.skippedAutoResolvedCases).toBe(1);

    // Completion rate on investigated cases
    expect(m.investigationCompletionRate).toBe(1.0); // 7/7 completed

    // Recommendation accuracy on investigated cases
    expect(m.recommendationAccuracy).toBe(1.0); // 7/7 aligned with ground truth

    // Evidence citation validity
    expect(m.evidenceCitationValidity).toBe(1.0); // all citations valid

    // Policy violation rate with deterministic provider is 0.0 (zero violations)
    expect(m.policyViolationRate).toBe(0.0);
    // All 7 investigated exception cases strictly enforce human review under accounting safety rule 7
    expect(m.forcedHumanReviewRate).toBe(1.0);

    // Non-zero execution timing and tool calls
    expect(m.averageInvestigationTimeMs).toBeGreaterThanOrEqual(0);
    expect(m.averageToolCallsPerInvestigation).toBeGreaterThan(0);

    // Counts structure is complete
    expect(m.counts.totalToolCalls).toBeGreaterThan(0);
    expect(m.counts.recommendationMatchesCount).toBe(7);
  });

  it("handles empty investigation list gracefully without division by zero", () => {
    const { metrics, caseEvaluations } = calculateAgentMetrics([], []);
    expect(metrics.totalCases).toBe(0);
    expect(metrics.investigationCompletionRate).toBe(0);
    expect(metrics.recommendationAccuracy).toBe(0);
    expect(metrics.averageInvestigationTimeMs).toBe(0);
    expect(caseEvaluations.length).toBe(0);
  });

  it("correctly evaluates recommendation alignment across exception types", () => {
    const groundTruth = loadGroundTruth("2024.1") as any;
    const cases = groundTruth.evaluationCases;

    const ec001 = cases.find((c: any) => c.id === "EC001")!;
    const ec002 = cases.find((c: any) => c.id === "EC002")!;
    const ec006 = cases.find((c: any) => c.id === "EC006")!;
    const ec007 = cases.find((c: any) => c.id === "EC007")!;

    expect(isRecommendationAccurate("NO_ACTION_REQUIRED", ec001)).toBe(true);
    expect(isRecommendationAccurate("APPROVE_MATCH", ec001)).toBe(true);
    expect(isRecommendationAccurate("MANUAL_ENTRY_REQUIRED", ec002)).toBe(true);
    expect(isRecommendationAccurate("REQUEST_EVIDENCE", ec006)).toBe(true);
    expect(isRecommendationAccurate("ESCALATE_TO_MANAGEMENT", ec007)).toBe(true);
    expect(isRecommendationAccurate("APPROVE_MATCH", ec007)).toBe(false);
  });
});
