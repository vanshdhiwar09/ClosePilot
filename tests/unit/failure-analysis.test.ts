// tests/unit/failure-analysis.test.ts
// Unit tests for structured failure diagnosis and root-cause categorization.

import { describe, it, expect } from "vitest";
import { diagnoseCaseFailure } from "../../src/evaluation/failure";
import { EvaluationCase } from "../../src/schemas/evaluation-case";
import { ReconcileTransactionOutput } from "../../src/reconciliation/pipeline";

describe("Evaluation Failure Diagnosis", () => {
  const mockCase: EvaluationCase = {
    id: "EC001",
    fixtureVersion: "2024.1",
    bankTransactionId: "BT001",
    expectedStatus: "matched",
    expectedAutoResolutionAllowed: true,
    expectedLedgerEntryIds: ["LE001"],
    expectedExceptionTypes: [],
  };

  const createMockOutput = (
    overrides?: Partial<ReconcileTransactionOutput["result"]> & {
      autoResolutionAllowed?: boolean;
      exceptions?: any[];
      evidence?: any[];
    }
  ): ReconcileTransactionOutput => ({
    result: {
      id: "REC-001",
      bankTransactionId: "BT001",
      candidateLedgerEntryIds: ["LE001"],
      matchedLedgerEntryIds: ["LE001"],
      status: "matched",
      matchMethod: "exact_match",
      confidence: "high",
      amountDifference: "0.00",
      evidenceIds: ["EVD-001"],
      exceptionIds: [],
      workflowVersion: "2024.1",
      createdAt: new Date().toISOString(),
      ...overrides,
    },
    exceptions: overrides?.exceptions ?? [],
    evidence: overrides?.evidence ?? [
      {
        id: "EVD-001",
        type: "bank_feed",
        sourceId: "BT001",
        description: "Primary bank transaction",
        confidence: 1.0,
      },
    ],
    autoResolutionAllowed: overrides?.autoResolutionAllowed ?? true,
    matchResult: {
      bankTransactionId: "BT001",
      status: "exact_match",
      candidates: [],
      candidateLedgerEntryIds: ["LE001"],
      matchedLedgerEntryIds: ["LE001"],
      amountDifference: "0.00",
      ruleTrace: [
        {
          rule: "exact_match",
          passed: true,
          description: "Monetary amount and date matched exactly",
          details: {},
        },
      ],
      confidence: "high",
      requiresReview: false,
      configVersion: "2024.1",
    },
  });

  it("returns undefined when predicted behavior completely agrees with ground truth", () => {
    const output = createMockOutput();
    const failure = diagnoseCaseFailure(mockCase, output);
    expect(failure).toBeUndefined();
  });

  it("diagnoses critical false auto-close when predicted auto-closure occurs on a review-required case", () => {
    const reviewCase: EvaluationCase = {
      ...mockCase,
      expectedStatus: "exception",
      expectedAutoResolutionAllowed: false,
      expectedExceptionTypes: ["potential_anomaly"],
    };

    // Output incorrectly auto-resolves
    const output = createMockOutput({
      status: "matched",
      autoResolutionAllowed: true,
    });

    const failure = diagnoseCaseFailure(reviewCase, output);
    expect(failure).toBeDefined();
    expect(failure?.disagreementType).toBe("auto_close_violation");
    expect(failure?.recommendedCategory).toBe("false_auto_close");
    expect(failure?.explanation).toContain("CRITICAL");
    expect(failure?.explanation).toContain("human review");
    expect(failure?.expectedOutcome.autoResolutionAllowed).toBe(false);
    expect(failure?.predictedOutcome.autoResolutionAllowed).toBe(true);
    expect(failure?.evidenceIds).toEqual(["EVD-001"]);
    expect(failure?.ruleTraceSummary[0]).toContain("[PASS] exact_match");
  });

  it("diagnoses unnecessary review when an eligible transaction is routed to review", () => {
    const output = createMockOutput({
      status: "review_required",
      autoResolutionAllowed: false,
    });

    const failure = diagnoseCaseFailure(mockCase, output);
    expect(failure).toBeDefined();
    expect(failure?.disagreementType).toBe("auto_close_violation");
    expect(failure?.recommendedCategory).toBe("unnecessary_review");
    expect(failure?.explanation).toContain("unnecessarily routed to review");
  });

  it("diagnoses status mismatch when status differs between predicted and ground truth", () => {
    const caseWithReview: EvaluationCase = {
      ...mockCase,
      expectedStatus: "review_required",
      expectedAutoResolutionAllowed: false,
    };

    const output = createMockOutput({
      status: "exception",
      autoResolutionAllowed: false,
    });

    const failure = diagnoseCaseFailure(caseWithReview, output);
    expect(failure).toBeDefined();
    expect(failure?.disagreementType).toBe("status_mismatch");
    expect(failure?.recommendedCategory).toBe("status_mismatch");
    expect(failure?.explanation).toContain('expected "review_required", but got "exception"');
  });

  it("diagnoses candidate mismatch when matched ledger entries differ", () => {
    const output = createMockOutput({
      matchedLedgerEntryIds: ["LE002"], // expected LE001
    });

    const failure = diagnoseCaseFailure(mockCase, output);
    expect(failure).toBeDefined();
    expect(failure?.disagreementType).toBe("candidate_mismatch");
    expect(failure?.recommendedCategory).toBe("wrong_candidate");
    expect(failure?.explanation).toContain("expected ledger entries [LE001], but matched [LE002]");
  });

  it("diagnoses missed duplicate exception when duplicate is omitted", () => {
    const duplicateCase: EvaluationCase = {
      ...mockCase,
      expectedStatus: "exception",
      expectedAutoResolutionAllowed: false,
      expectedExceptionTypes: ["duplicate"],
    };

    const output = createMockOutput({
      status: "exception",
      autoResolutionAllowed: false,
      exceptions: [], // missed duplicate
    });

    const failure = diagnoseCaseFailure(duplicateCase, output);
    expect(failure).toBeDefined();
    expect(failure?.disagreementType).toBe("exception_mismatch");
    expect(failure?.recommendedCategory).toBe("missed_duplicate");
    expect(failure?.explanation).toContain("expected [duplicate], but detected []");
  });

  it("diagnoses missed generic exception when expected exception is absent", () => {
    const amountCase: EvaluationCase = {
      ...mockCase,
      expectedStatus: "exception",
      expectedAutoResolutionAllowed: false,
      expectedExceptionTypes: ["amount_mismatch"],
    };

    const output = createMockOutput({
      status: "exception",
      autoResolutionAllowed: false,
      exceptions: [],
    });

    const failure = diagnoseCaseFailure(amountCase, output);
    expect(failure).toBeDefined();
    expect(failure?.disagreementType).toBe("exception_mismatch");
    expect(failure?.recommendedCategory).toBe("missed_exception");
  });

  it("diagnoses spurious exception when unexpected exception is raised", () => {
    const output = createMockOutput({
      exceptions: [
        {
          id: "EXC-001",
          reconciliationResultId: "REC-001",
          type: "timing_difference",
          severity: "low",
          requiresHumanReview: false,
          suggestedAction: "Wait",
        },
      ],
    });

    const failure = diagnoseCaseFailure(mockCase, output);
    expect(failure).toBeDefined();
    expect(failure?.disagreementType).toBe("exception_mismatch");
    expect(failure?.recommendedCategory).toBe("spurious_exception");
  });
});
