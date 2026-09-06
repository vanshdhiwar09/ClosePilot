// tests/unit/close-package.test.ts
// Unit tests for ClosePilot evidence-backed ClosePackage generator,
// executive summary calculations, and audit traceability.

import { describe, it, expect } from "vitest";
import {
  createFixtureReviewSession,
  generateClosePackage,
  generateFixtureClosePackage,
  formatClosePackageMarkdown,
} from "../../src/review/close-package";
import { createAuditEvidenceItem } from "../../src/review/evidence";

describe("ClosePackage Generator & Audit Verification", () => {
  it("generates an accurate baseline ClosePackage from 2024.1 fixture representing unresolved items", () => {
    // Generate baseline package without injecting synthetic human decisions
    const pkg = generateFixtureClosePackage("month-end-reconciliation-2024.1", "2024.1");

    expect(pkg.period).toBe("2024.1");
    expect(pkg.workflowVersion).toBe("2024.1");
    expect(pkg.cases).toHaveLength(8);

    const s = pkg.summary;
    expect(s.totalCases).toBe(8);
    expect(s.automaticallyResolvedCases).toBe(1); // BT001 only
    expect(s.humanReviewedCases).toBe(0); // No human actions yet
    expect(s.approvedCases).toBe(0);
    expect(s.rejectedCases).toBe(0);
    expect(s.unresolvedCases).toBe(7); // BT002-BT008 remain open
    expect(s.allCasesClosed).toBe(false);

    // Verify exception counts match the actual detected exceptions
    expect(s.exceptionCounts["unmatched_transaction"]).toBe(1);
    expect(s.exceptionCounts["amount_mismatch"]).toBe(1);
    expect(s.exceptionCounts["timing_difference"]).toBe(1);
    expect(s.exceptionCounts["duplicate"]).toBe(1);
    expect(s.exceptionCounts["missing_documentation"]).toBe(1);
    expect(s.exceptionCounts["potential_anomaly"]).toBe(1);

    // Verify BigInt monetary sums: BT001 is $1250.00
    expect(s.totalReconciledAmount).toBe("1250.00");
    // All 7 unclosed transactions total:
    // BT002 ($750.00) + BT003 ($2500.00) + BT004 ($1250.00) + BT005 ($500.00) + BT006 ($300.00) + BT007 ($15000.00) + BT008 ($1000.00) = $21,300.00
    expect(s.totalUnreconciledAmount).toBe("21300.00");

    // Traceability on BT001 (auto-resolved)
    const ec001 = pkg.cases.find((c) => c.bankTransactionId === "BT001")!;
    expect(ec001.isClosed).toBe(true);
    expect(ec001.finalStatus).toBe("closed");
    expect(ec001.closureReason).toContain("Auto-reconciled");
    expect(ec001.reconciliationResult.status).toBe("matched");
    expect(ec001.ruleTrace.length).toBeGreaterThan(0);
    expect(ec001.evidence.length).toBeGreaterThan(0);

    // Traceability on BT006 (unresolved missing documentation)
    const ec006 = pkg.cases.find((c) => c.bankTransactionId === "BT006")!;
    expect(ec006.isClosed).toBe(false);
    expect(ec006.finalStatus).toBe("unresolved");
    expect(ec006.closureReason).toContain("Unresolved: Human review is required");
    expect(ec006.exceptions.map((e) => e.type)).toContain("missing_documentation");
  });

  it("produces a fully closed package when all review cases are validly resolved with evidence", () => {
    const session = createFixtureReviewSession("month-end-reconciliation-2024.1", "2024.1");
    const reviewer = { id: "REV-CONTROLLER", name: "Jane Controller", role: "Financial Controller" };

    // Resolve BT002 (unmatched transaction): review and approve manual entry creation
    session.applyAction({
      caseId: "EC002",
      action: "APPROVE",
      reviewer,
      reason: "Manual ledger entry booked to suspense account",
    });

    // Resolve BT003 (amount mismatch): approve variance with price credit memo
    session.applyAction({
      caseId: "EC003",
      action: "APPROVE",
      reviewer,
      reason: "Variance of $250.00 confirmed with vendor; credit memo attached",
    });

    // Resolve BT004 (timing difference): approve 1-day timing clearance
    session.applyAction({
      caseId: "EC004",
      action: "APPROVE",
      reviewer,
      reason: "1-day timing clearance confirmed against bank statement",
    });

    // Resolve BT005 (duplicate candidates): approve primary candidate selection
    session.applyAction({
      caseId: "EC005",
      action: "APPROVE",
      reviewer,
      reason: "Duplicate entry LE006 voided in subledger; matched with LE005",
    });

    // Resolve BT006 (missing documentation): multi-step request -> supply -> approve
    session.applyAction({
      caseId: "EC006",
      action: "REQUEST_EVIDENCE",
      reviewer,
      reason: "Requesting vendor receipt for $300.00 office supplies expense",
    });

    const receiptEvidence = createAuditEvidenceItem({
      caseId: "EC006",
      description: "Vendor receipt REC-2024-003.pdf supplied by AP team",
      kind: "document",
      payload: { fileName: "REC-2024-003.pdf", verified: true },
    });

    session.applyAction({
      caseId: "EC006",
      action: "SUPPLY_EVIDENCE",
      reviewer: { id: "AP-SPECIALIST", name: "AP Team" },
      reason: "Supplied missing receipt from vendor portal",
      newEvidence: [receiptEvidence],
    });

    session.applyAction({
      caseId: "EC006",
      action: "APPROVE",
      reviewer,
      reason: "Receipt verified and matched with LE004",
      evidenceIds: [receiptEvidence.id],
    });

    // Resolve BT007 (potential anomaly): approve $15,000 capital equipment expenditure
    session.applyAction({
      caseId: "EC007",
      action: "APPROVE",
      reviewer,
      reason: "Approved: $15,000 corresponds to pre-authorized capital asset purchase",
    });

    // Resolve BT008 (ambiguous candidates): disambiguate and approve match with LE008a
    session.applyAction({
      caseId: "EC008",
      action: "APPROVE",
      reviewer,
      reason: "Disambiguated: LE008a matches bank transaction reference AMB-001",
    });

    // Generate package after all human review decisions
    const pkg = generateClosePackage(session, { period: "2024.1" });
    const s = pkg.summary;

    expect(s.totalCases).toBe(8);
    expect(s.automaticallyResolvedCases).toBe(1);
    expect(s.humanReviewedCases).toBe(7);
    expect(s.approvedCases).toBe(7);
    expect(s.rejectedCases).toBe(0);
    expect(s.unresolvedCases).toBe(0);
    expect(s.allCasesClosed).toBe(true);

    // All $22,550.00 reconciled!
    expect(s.totalReconciledAmount).toBe("22550.00");
    expect(s.totalUnreconciledAmount).toBe("0.00");

    // Check BT006 multi-step decision history
    const c006 = pkg.cases.find((c) => c.bankTransactionId === "BT006")!;
    expect(c006.isClosed).toBe(true);
    expect(c006.decisionHistory).toHaveLength(3); // REQUEST -> SUPPLY -> APPROVE
    expect(c006.decisionHistory[0].action).toBe("REQUEST_EVIDENCE");
    expect(c006.decisionHistory[1].action).toBe("SUPPLY_EVIDENCE");
    expect(c006.decisionHistory[2].action).toBe("APPROVE");
    expect(c006.evidence.some((e) => e.id === receiptEvidence.id)).toBe(true);
  });

  it("reflects rejected cases accurately and does not mark package fully closed", () => {
    const session = createFixtureReviewSession("month-end-reconciliation-2024.1", "2024.1");
    const reviewer = { id: "REV-01" };

    session.applyAction({
      caseId: "EC002",
      action: "REJECT",
      reviewer,
      reason: "Transaction appears fraudulent; reported to bank",
    });

    const pkg = generateClosePackage(session);
    expect(pkg.summary.rejectedCases).toBe(1);
    expect(pkg.summary.allCasesClosed).toBe(false);

    const c002 = pkg.cases.find((c) => c.caseId === "EC002")!;
    expect(c002.finalStatus).toBe("rejected");
    expect(c002.isClosed).toBe(false);
    expect(c002.closureReason).toContain("Rejected by human reviewer");
  });

  it("formats audit-ready markdown report with executive summary, exceptions, and case breakdown", () => {
    const session = createFixtureReviewSession();
    session.applyAction({
      caseId: "EC004",
      action: "APPROVE",
      reviewer: { id: "REV-01" },
      reason: "Timing approved",
    });

    const pkg = generateClosePackage(session);
    const md = formatClosePackageMarkdown(pkg);

    expect(md).toContain("# ClosePilot Month-End Close Package — Period 2024.1");
    expect(md).toContain("## 1. Executive Close Summary");
    expect(md).toContain("## 2. Exception Breakdown");
    expect(md).toContain("## 3. Case-by-Case Close Ledger & Traceability");
    expect(md).toContain("## 4. Detailed Audit & Traceability Records");
    expect(md).toContain("BT001");
    expect(md).toContain("BT004");
    expect(md).toContain("timing_difference");
    expect(md).toContain("Timing approved");
  });
});
