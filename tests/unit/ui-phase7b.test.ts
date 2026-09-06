// tests/unit/ui-phase7b.test.ts
// Unit tests for ClosePilot Phase 7B: Exceptions, Investigation & Human Review UI Integration.

import { describe, it, expect } from "vitest";
import {
  getWorkflowState,
  getExceptionCases,
  getCaseInvestigationDetail,
  executeReviewAction,
} from "../../src/ui/adapter/data-adapter";
import { InvalidStateTransitionError, InvalidDecisionError } from "../../src/review/types";

describe("Phase 7B: Exceptions, Investigation & Human Review Integration", () => {
  it("retrieves the actual 7 review cases (BT002..BT008) from the workflow session", async () => {
    const state = await getWorkflowState(true);
    const cases = getExceptionCases(state);

    // Must be exactly 7 cases (BT001 auto-resolved is excluded from human review queue)
    expect(cases).toHaveLength(7);

    const bankTxIds = cases.map((c) => c.bankTxId).sort();
    expect(bankTxIds).toEqual(["BT002", "BT003", "BT004", "BT005", "BT006", "BT007", "BT008"]);

    // All 7 cases start in REVIEW_REQUIRED state
    for (const c of cases) {
      expect(c.reviewStatus).toBe("REVIEW_REQUIRED");
      expect(c.rawAmount).toBeGreaterThan(0);
    }
  });

  it("accurately classifies exception types matching domain results", async () => {
    const state = await getWorkflowState(false);
    const cases = getExceptionCases(state);

    const typeByTx = Object.fromEntries(cases.map((c) => [c.bankTxId, c.exceptionType]));

    expect(typeByTx["BT002"]).toBe("unmatched_transaction");
    expect(typeByTx["BT003"]).toBe("amount_mismatch");
    expect(typeByTx["BT004"]).toBe("timing_difference");
    expect(typeByTx["BT005"]).toBe("duplicate");
    expect(typeByTx["BT006"]).toBe("missing_documentation");
    expect(typeByTx["BT007"]).toBe("potential_anomaly");
    expect(typeByTx["BT008"]).toBe("ambiguous");
  });

  it("correctly models BT007 as flagship anomaly with verified domain properties", async () => {
    const state = await getWorkflowState(false);
    const detail = getCaseInvestigationDetail(state, "EC007");

    // Case and Bank ID
    expect(detail.summary.caseId).toBe("EC007");
    expect(detail.summary.bankTxId).toBe("BT007");
    expect(detail.summary.isFlagship).toBe(true);

    // Verified Amount ($15,000.00)
    expect(detail.summary.amount).toBe("$15,000.00");
    expect(detail.summary.rawAmount).toBe(15000);

    // Flagged reason comes from reconciliation output
    expect(detail.flaggedReason.code).toBe("ACCOUNT_AMOUNT_OUTLIER");
    expect(detail.flaggedReason.technicalDetails).toContain("exceeds account Acct123 threshold");

    // Investigation outcome and recommendation
    expect(detail.investigation.outcome).toBe("COMPLETED");
    expect(detail.investigation.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");
    expect(detail.investigation.requiresHumanReview).toBe(true);
    expect(detail.investigation.riskLevel).toBe("CRITICAL");
    expect(detail.investigation.confidence).toBe("HIGH");
    expect(detail.investigation.rootCause).toContain("5x median 1250.00");
    expect(detail.investigation.rootCause).toContain("6250.00");

    // Observability trace
    expect(detail.investigation.runId).toMatch(/^INV-EC007/);
    expect(detail.toolCalls.length).toBeGreaterThan(0);

    const toolNames = detail.toolCalls.map((tc) => tc.toolName);
    expect(toolNames).toContain("get_case");
    expect(toolNames).toContain("get_evidence");

    // Evidence preserved
    expect(detail.evidence.length).toBeGreaterThan(0);
    const evidenceIds = detail.evidence.map((e) => e.id);
    expect(evidenceIds).toContain("EV-SRC-BT007-RES-BT007");
    expect(evidenceIds).toContain("EV-CALC-anomaly_threshold-RES-BT007");

    // Policy evaluations preserved
    expect(detail.policyEvaluations.length).toBeGreaterThan(0);
    const policyRules = detail.policyEvaluations.map((p) => p.policyRule);
    expect(policyRules).toContain("ACCOUNTING_STANDARD_CLEARANCE");
  });

  it("applies valid human review action and updates state machine deterministically", async () => {
    const state = await getWorkflowState(true);

    // Before action: EC007 is REVIEW_REQUIRED
    const detailBefore = getCaseInvestigationDetail(state, "EC007");
    expect(detailBefore.summary.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(detailBefore.allowedActions).toContain("APPROVE");
    expect(detailBefore.allowedActions).toContain("REJECT");
    expect(detailBefore.allowedActions).toContain("REQUEST_EVIDENCE");

    // Apply APPROVE
    const decision = executeReviewAction(state, {
      caseId: "EC007",
      action: "APPROVE",
      reason: "Approved capital expenditure after verifying purchase order authorization.",
      reviewer: { id: "REV-CONTROLLER", name: "Chief Controller", role: "Controller" },
    });

    expect(decision.previousState).toBe("REVIEW_REQUIRED");
    expect(decision.newState).toBe("RESOLVED");
    expect(decision.action).toBe("APPROVE");

    // After action: EC007 is RESOLVED (terminal)
    const detailAfter = getCaseInvestigationDetail(state, "EC007");
    expect(detailAfter.summary.reviewStatus).toBe("RESOLVED");
    expect(detailAfter.summary.reviewStatusLabel).toBe("Resolved");
    expect(detailAfter.allowedActions).toHaveLength(0); // Terminal state

    // Decision appears in audit history
    expect(detailAfter.decisionHistory).toHaveLength(1);
    expect(detailAfter.decisionHistory[0].action).toBe("APPROVE");
    expect(detailAfter.decisionHistory[0].reason).toContain("purchase order authorization");
  });

  it("enforces domain state machine guardrails and prevents invalid transitions", async () => {
    const state = await getWorkflowState(true);

    // 1. Mandatory reason test
    expect(() => {
      executeReviewAction(state, {
        caseId: "EC003",
        action: "APPROVE",
        reason: "   ", // Empty whitespace reason
      });
    }).toThrow(InvalidDecisionError);

    // 2. REQUEST_EVIDENCE transition
    executeReviewAction(state, {
      caseId: "EC003",
      action: "REQUEST_EVIDENCE",
      reason: "Requesting vendor credit memo for price discrepancy.",
    });

    const waitingCase = getCaseInvestigationDetail(state, "EC003");
    expect(waitingCase.summary.reviewStatus).toBe("WAITING_FOR_EVIDENCE");
    expect(waitingCase.allowedActions).toEqual(["SUPPLY_EVIDENCE"]);

    // 3. Invalid transition from WAITING_FOR_EVIDENCE directly to APPROVE is blocked
    expect(() => {
      executeReviewAction(state, {
        caseId: "EC003",
        action: "APPROVE",
        reason: "Attempting illegal premature approval without evidence.",
      });
    }).toThrow(InvalidStateTransitionError);
  });
});
