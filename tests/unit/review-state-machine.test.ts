// tests/unit/review-state-machine.test.ts
// Unit tests for the ClosePilot Human Review State Machine, auditable decisions,
// evidence validation, and state-transition invariants.

import { describe, it, expect } from "vitest";
import { HumanReviewSession } from "../../src/review/state-machine";
import {
  CaseNotFoundError,
  CaseReviewInput,
  InvalidDecisionError,
  InvalidEvidenceError,
  InvalidStateTransitionError,
  UnresolvedCaseError,
} from "../../src/review/types";
import { createAuditEvidenceItem } from "../../src/review/evidence";
import { BankTransaction } from "../../src/schemas/bank-transaction";
import { ReconciliationResult } from "../../src/schemas/reconciliation-result";
import { ReconcileTransactionOutput } from "../../src/reconciliation/pipeline";

describe("Human Review State Machine", () => {
  const createMockBankTx = (id: string, amount: string = "100.00"): BankTransaction => ({
    id,
    accountId: "Acct123",
    transactionDate: "2024-01-15",
    amount,
    currency: "USD",
    direction: "debit",
    description: `Test Transaction ${id}`,
    source: "synthetic_bank",
    sourceRecordId: `SRC-${id}`,
    schemaVersion: "1",
    ingestedAt: "2024-01-15T00:00:00Z",
    rawHash: "hash123",
  });

  const createMockResult = (
    id: string,
    bankTxId: string,
    status: ReconciliationResult["status"] = "review_required"
  ): ReconciliationResult => ({
    id: `RES-${id}`,
    bankTransactionId: bankTxId,
    candidateLedgerEntryIds: ["LE001"],
    matchedLedgerEntryIds: status === "matched" ? ["LE001"] : [],
    status,
    matchMethod: "exact_match",
    confidence: "high",
    amountDifference: "0.00",
    evidenceIds: ["EVD-001"],
    exceptionIds: [],
    workflowVersion: "2024.1",
    createdAt: "2024-01-15T00:00:00Z",
  });

  const createMockOutput = (
    caseId: string,
    autoAllowed: boolean = false,
    status: ReconciliationResult["status"] = "review_required"
  ): ReconcileTransactionOutput => ({
    result: createMockResult(caseId, `BT-${caseId}`, status),
    exceptions: autoAllowed
      ? []
      : [
          {
            id: `EXC-${caseId}`,
            resultId: `RES-${caseId}`,
            type: "timing_difference",
            severity: "medium",
            status: "open",
            reasonCode: "TIMING_OUTSIDE_WINDOW",
            evidenceIds: ["EVD-001"],
            createdAt: "2024-01-15T00:00:00Z",
          },
        ],
    evidence: [
      {
        id: "EVD-001",
        kind: "source_record",
        subjectType: "result",
        subjectId: `RES-${caseId}`,
        payload: { source: "bank_feed" },
        createdAt: "2024-01-15T00:00:00Z",
      },
    ],
    autoResolutionAllowed: autoAllowed,
  });

  const createMockCaseInput = (
    caseId: string,
    autoAllowed: boolean = false
  ): CaseReviewInput => ({
    caseId,
    bankTransaction: createMockBankTx(`BT-${caseId}`),
    reconciliationOutput: createMockOutput(caseId, autoAllowed),
    candidateLedgerEntries: [],
  });

  it("initializes review-required cases in REVIEW_REQUIRED state", () => {
    const session = new HumanReviewSession([createMockCaseInput("C1", false)]);
    const c1 = session.getCase("C1");

    expect(c1.currentState).toBe("REVIEW_REQUIRED");
    expect(c1.isAutoResolved).toBe(false);
    expect(c1.decisionHistory).toHaveLength(0);
    expect(session.isCaseClosed("C1")).toBe(false);
  });

  it("initializes auto-resolved cases in AUTO_RESOLVED state and marks them closed", () => {
    const autoOutput = createMockOutput("C_AUTO", true, "matched");
    const session = new HumanReviewSession([
      {
        caseId: "C_AUTO",
        bankTransaction: createMockBankTx("BT-C_AUTO"),
        reconciliationOutput: autoOutput,
      },
    ]);

    const cAuto = session.getCase("C_AUTO");
    expect(cAuto.currentState).toBe("AUTO_RESOLVED");
    expect(cAuto.isAutoResolved).toBe(true);
    expect(session.isCaseClosed("C_AUTO")).toBe(true);

    // Attempting to apply human review action to an auto-resolved case must throw
    expect(() =>
      session.applyAction({
        caseId: "C_AUTO",
        action: "APPROVE",
        reviewer: { id: "REV-01" },
        reason: "Unnecessary approval",
      })
    ).toThrow(InvalidStateTransitionError);
  });

  it("executes valid APPROVE transition from REVIEW_REQUIRED to RESOLVED", () => {
    const session = new HumanReviewSession([createMockCaseInput("C1")]);

    const decision = session.applyAction({
      caseId: "C1",
      action: "APPROVE",
      reviewer: { id: "REV-01", name: "Alice Reviewer" },
      reason: "Timing difference is within acceptable 2-day policy window",
      evidenceIds: ["EVD-001"],
    });

    expect(decision.previousState).toBe("REVIEW_REQUIRED");
    expect(decision.newState).toBe("RESOLVED");
    expect(decision.action).toBe("APPROVE");
    expect(decision.reviewer.id).toBe("REV-01");

    const c1 = session.getCase("C1");
    expect(c1.currentState).toBe("RESOLVED");
    expect(c1.decisionHistory).toHaveLength(1);
    expect(session.isCaseClosed("C1")).toBe(true);

    const closeStatus = session.getCaseCloseStatus("C1");
    expect(closeStatus.finalStatus).toBe("closed");
    expect(closeStatus.isClosed).toBe(true);
    expect(closeStatus.closureReason).toContain("Resolved by human reviewer approval");
  });

  it("executes valid REJECT transition from REVIEW_REQUIRED to REJECTED", () => {
    const session = new HumanReviewSession([createMockCaseInput("C1")]);

    const decision = session.applyAction({
      caseId: "C1",
      action: "REJECT",
      reviewer: { id: "REV-01" },
      reason: "Invalid counterparty reference mismatch",
      evidenceIds: ["EVD-001"],
    });

    expect(decision.newState).toBe("REJECTED");
    expect(session.isCaseClosed("C1")).toBe(false);

    const closeStatus = session.getCaseCloseStatus("C1");
    expect(closeStatus.finalStatus).toBe("rejected");
    expect(closeStatus.isClosed).toBe(false);
    expect(closeStatus.closureReason).toContain("Rejected by human reviewer");
  });

  it("executes valid REQUEST_EVIDENCE and return-to-review cycle via SUPPLY_EVIDENCE", () => {
    const session = new HumanReviewSession([createMockCaseInput("C1")]);

    // Step 1: Request evidence
    const d1 = session.applyAction({
      caseId: "C1",
      action: "REQUEST_EVIDENCE",
      reviewer: { id: "REV-01" },
      reason: "Please supply the signed vendor invoice",
    });

    expect(d1.newState).toBe("WAITING_FOR_EVIDENCE");
    expect(session.getCase("C1").currentState).toBe("WAITING_FOR_EVIDENCE");
    expect(session.isCaseClosed("C1")).toBe(false);

    // Cannot approve directly while waiting for evidence!
    expect(() =>
      session.applyAction({
        caseId: "C1",
        action: "APPROVE",
        reviewer: { id: "REV-01" },
        reason: "Premature approval",
      })
    ).toThrow(InvalidStateTransitionError);

    // Step 2: Supply required evidence
    const newDocEvidence = createAuditEvidenceItem({
      caseId: "C1",
      description: "Signed vendor invoice INV-2024-001.pdf",
      kind: "document",
      payload: { fileName: "INV-2024-001.pdf", verified: true },
    });

    const d2 = session.applyAction({
      caseId: "C1",
      action: "SUPPLY_EVIDENCE",
      reviewer: { id: "REV-02", role: "Accounts Payable" },
      reason: "Invoice INV-2024-001 provided with verified signature",
      newEvidence: [newDocEvidence],
    });

    expect(d2.previousState).toBe("WAITING_FOR_EVIDENCE");
    expect(d2.newState).toBe("REVIEW_REQUIRED");
    expect(session.getCase("C1").currentState).toBe("REVIEW_REQUIRED");
    expect(session.isCaseClosed("C1")).toBe(false);

    // Verify newly supplied evidence was appended to the case evidence pool
    const c1 = session.getCase("C1");
    expect(c1.evidence).toHaveLength(2); // original EVD-001 + newDocEvidence
    expect(c1.evidence.some((e) => e.id === newDocEvidence.id)).toBe(true);

    // Step 3: Now approval succeeds
    const d3 = session.applyAction({
      caseId: "C1",
      action: "APPROVE",
      reviewer: { id: "REV-01" },
      reason: "Invoice verified against bank transaction amount",
      evidenceIds: [newDocEvidence.id],
    });

    expect(d3.newState).toBe("RESOLVED");
    expect(session.isCaseClosed("C1")).toBe(true);
    expect(c1.decisionHistory).toHaveLength(2); // d1 and d2 in history + d3 now
  });

  it("prevents transitions from terminal states RESOLVED and REJECTED", () => {
    const session = new HumanReviewSession([
      createMockCaseInput("C_RES"),
      createMockCaseInput("C_REJ"),
    ]);

    session.applyAction({
      caseId: "C_RES",
      action: "APPROVE",
      reviewer: { id: "REV-01" },
      reason: "Initial approval",
    });

    session.applyAction({
      caseId: "C_REJ",
      action: "REJECT",
      reviewer: { id: "REV-01" },
      reason: "Initial rejection",
    });

    // Attempting further actions on terminal states must fail
    expect(() =>
      session.applyAction({
        caseId: "C_RES",
        action: "REJECT",
        reviewer: { id: "REV-01" },
        reason: "Secondary reject",
      })
    ).toThrow(InvalidStateTransitionError);

    expect(() =>
      session.applyAction({
        caseId: "C_REJ",
        action: "APPROVE",
        reviewer: { id: "REV-01" },
        reason: "Secondary approve",
      })
    ).toThrow(InvalidStateTransitionError);
  });

  it("fails explicitly when given a nonexistent case ID", () => {
    const session = new HumanReviewSession([createMockCaseInput("C1")]);

    expect(() =>
      session.applyAction({
        caseId: "NONEXISTENT_CASE",
        action: "APPROVE",
        reviewer: { id: "REV-01" },
        reason: "Test",
      })
    ).toThrow(CaseNotFoundError);

    expect(() => session.getCase("NONEXISTENT_CASE")).toThrow(CaseNotFoundError);
  });

  it("fails explicitly when referencing invalid evidence IDs", () => {
    const session = new HumanReviewSession([createMockCaseInput("C1")]);

    expect(() =>
      session.applyAction({
        caseId: "C1",
        action: "APPROVE",
        reviewer: { id: "REV-01" },
        reason: "Approve with bogus evidence",
        evidenceIds: ["EVD-NONEXISTENT-999"],
      })
    ).toThrow(InvalidEvidenceError);
  });

  it("fails explicitly when decision reason or reviewer ID is blank", () => {
    const session = new HumanReviewSession([createMockCaseInput("C1")]);

    expect(() =>
      session.applyAction({
        caseId: "C1",
        action: "APPROVE",
        reviewer: { id: "REV-01" },
        reason: "   ",
      })
    ).toThrow(InvalidDecisionError);

    expect(() =>
      session.applyAction({
        caseId: "C1",
        action: "APPROVE",
        reviewer: { id: "" },
        reason: "Valid reason",
      })
    ).toThrow(InvalidDecisionError);
  });

  it("fails explicitly on duplicate decision IDs", () => {
    const session = new HumanReviewSession([
      createMockCaseInput("C1"),
      createMockCaseInput("C2"),
    ]);

    session.applyAction({
      caseId: "C1",
      action: "APPROVE",
      reviewer: { id: "REV-01" },
      reason: "Approve 1",
      decisionId: "FIXED-DEC-001",
    });

    expect(() =>
      session.applyAction({
        caseId: "C2",
        action: "APPROVE",
        reviewer: { id: "REV-01" },
        reason: "Approve 2",
        decisionId: "FIXED-DEC-001", // duplicate!
      })
    ).toThrow(InvalidDecisionError);
  });

  it("assertCaseClosed throws UnresolvedCaseError on unclosed or rejected cases", () => {
    const session = new HumanReviewSession([
      createMockCaseInput("C_OPEN"),
      createMockCaseInput("C_REJ"),
    ]);

    session.applyAction({
      caseId: "C_REJ",
      action: "REJECT",
      reviewer: { id: "REV-01" },
      reason: "Rejected",
    });

    expect(() => session.assertCaseClosed("C_OPEN")).toThrow(UnresolvedCaseError);
    expect(() => session.assertCaseClosed("C_REJ")).toThrow(UnresolvedCaseError);
  });

  it("guarantees immutability of original reconciliation result and source transaction", () => {
    const input = createMockCaseInput("C1");
    const originalAmount = input.bankTransaction.amount;
    const originalResultStatus = input.reconciliationOutput.result.status;
    const originalEvidenceCount = input.reconciliationOutput.evidence.length;

    const session = new HumanReviewSession([input]);

    const newEvidence = createAuditEvidenceItem({
      caseId: "C1",
      description: "Additional note",
      payload: { note: "All good" },
    });

    session.applyAction({
      caseId: "C1",
      action: "REQUEST_EVIDENCE",
      reviewer: { id: "REV-01" },
      reason: "Need documentation",
    });

    session.applyAction({
      caseId: "C1",
      action: "SUPPLY_EVIDENCE",
      reviewer: { id: "REV-01" },
      reason: "Supplying note",
      newEvidence: [newEvidence],
    });

    session.applyAction({
      caseId: "C1",
      action: "APPROVE",
      reviewer: { id: "REV-01" },
      reason: "Final signoff",
    });

    // Original input objects must NOT have been mutated
    expect(input.bankTransaction.amount).toBe(originalAmount);
    expect(input.reconciliationOutput.result.status).toBe(originalResultStatus);
    expect(input.reconciliationOutput.evidence).toHaveLength(originalEvidenceCount);
  });
});
