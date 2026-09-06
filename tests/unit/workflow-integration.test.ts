// tests/unit/workflow-integration.test.ts
// Tests for Phase 5B End-to-End Workflow:
// Reconciliation -> Autonomous Investigation -> Review Queue -> Human Review State Machine -> Close Package

import { describe, it, expect } from "vitest";
import { runEndToEndReconciliationWorkflow } from "../../src/workflow/reconciliation-workflow";
import { formatClosePackageMarkdown } from "../../src/review/close-package";
import { HumanReviewSession } from "../../src/review/state-machine";
import { buildReviewQueue, buildReviewerGuidance } from "../../src/review/queue";
import { AutonomousInvestigator } from "../../src/agent/investigator";
import { DeterministicMockProvider } from "../../src/agent/provider";
import { ReadOnlyInvestigationToolbox, InvestigationContext } from "../../src/agent/tools";
import { loadFixture, loadGroundTruth } from "../../src/schemas/fixture-loader";

describe("Phase 5B End-to-End Workflow Integration", () => {
  it("runs deterministic reconciliation and auto-resolved case bypasses investigation", async () => {
    const res = await runEndToEndReconciliationWorkflow({
      fixtureName: "month-end-reconciliation-2024.1",
      groundTruthVersion: "2024.1",
    });

    // Summary counts
    expect(res.summary.totalCases).toBe(8);
    expect(res.summary.autoResolvedCases).toBe(1); // EC001 / BT001
    expect(res.summary.investigatedCases).toBe(7); // EC002..EC008
    expect(res.summary.reviewQueueItems).toBe(7);

    // Check that auto-resolved case EC001 did NOT enter manual review queue
    const autoResolvedInQueue = res.reviewQueue.find((q) => q.caseId === "EC001");
    expect(autoResolvedInQueue).toBeUndefined();
  });

  it("exceptions enter investigation and results appear in review queue", async () => {
    const res = await runEndToEndReconciliationWorkflow();

    // Verify all 7 exception cases are in the review queue
    const queueCaseIds = res.reviewQueue.map((q) => q.caseId);
    expect(queueCaseIds).toEqual(["EC002", "EC003", "EC004", "EC005", "EC006", "EC007", "EC008"]);

    // Check each queue item has investigation attached
    for (const item of res.reviewQueue) {
      expect(item.investigation).toBeDefined();
      expect(item.investigation?.investigationId).toMatch(/^INV-/);
      expect(item.investigation?.outcome).toBe("COMPLETED");
      expect(item.investigation?.recommendation).toBeDefined();
    }
  });

  it("reviewer receives complete evidence, rule trace, and 9-point guidance", async () => {
    const res = await runEndToEndReconciliationWorkflow();
    const ec004 = res.reviewQueue.find((q) => q.caseId === "EC004")!;

    expect(ec004).toBeDefined();
    expect(ec004.bankTransactionId).toBe("BT004");
    expect(ec004.exceptions.some((e) => e.type === "timing_difference")).toBe(true);

    // Rule trace
    expect(ec004.ruleTrace.length).toBeGreaterThan(0);

    // Guidance answering 9 reviewer questions
    const g = ec004.guidance;
    expect(g.whatHappened).toContain("BT004"); // 1. What happened?
    expect(g.whyFlagged.some((f) => f.includes("timing_difference"))).toBe(true); // 2. Why flagged?
    expect(g.evidenceSummary).toContain("evidence item(s)"); // 3. What evidence exists?
    expect(g.agentInvestigationSummary).toBeDefined(); // 4. What did agent investigate?
    expect(g.agentRecommendation).toBe("APPROVE_MATCH"); // 5. What does agent recommend?
    expect(g.recommendationReason).toBeDefined(); // 6. Why?
    expect(g.confidence).toBe("HIGH"); // 7. Confidence
    expect(g.riskLevel).toBe("LOW"); // 7. Risk level
    expect(g.isPolicyPermitted).toBe(true); // 8. Policy permission
    expect(g.actionRequired).toBeDefined(); // 9. What human needs to decide
  });

  it("agent recommendation does NOT mutate review state; human approval remains required", async () => {
    const res = await runEndToEndReconciliationWorkflow();

    // Before any human action, all cases in review session remain in REVIEW_REQUIRED
    const ec004Case = res.session.getCase("EC004");
    expect(ec004Case.currentState).toBe("REVIEW_REQUIRED");
    expect(ec004Case.decisionHistory.length).toBe(0);

    // Even though agent recommended APPROVE_MATCH, state is NOT RESOLVED
    expect(ec004Case.currentState).not.toBe("RESOLVED");

    // Explicit human action is required to resolve
    const decision = res.session.applyAction({
      caseId: "EC004",
      action: "APPROVE",
      reviewer: { id: "rev_sarah_01", name: "Sarah Jenkins", role: "Senior Accountant" },
      reason: "Timing difference of 1 day verified against clearing receipt.",
      metadata: { selectedCandidateId: "LE001" },
    });

    expect(decision.action).toBe("APPROVE");
    expect(decision.newState).toBe("RESOLVED");

    const updatedCase = res.session.getCase("EC004");
    expect(updatedCase.currentState).toBe("RESOLVED");
    expect(updatedCase.decisionHistory.length).toBe(1);
    expect(updatedCase.decisionHistory[0].reviewer.id).toBe("rev_sarah_01");
  });

  it("close package includes investigation while preserving 4 independent audit facts", async () => {
    // Run workflow with explicit human approval for EC004
    const res = await runEndToEndReconciliationWorkflow({
      humanActions: [
        {
          caseId: "EC004",
          action: "APPROVE",
          reviewer: { id: "rev_sarah_01", name: "Sarah Jenkins" },
          reason: "Verified clearing window tolerance.",
          metadata: { selectedCandidateId: "LE001" },
        },
      ],
    });

    const closePkg = res.closePackage;
    const ec004Record = closePkg.cases.find((c) => c.caseId === "EC004")!;

    expect(ec004Record).toBeDefined();

    // Fact 1: Original reconciliation status is preserved as 'exception'
    expect(ec004Record.reconciliationResult.status).toBe("exception");

    // Fact 2: Agent investigation recommendation is independently auditable
    expect(ec004Record.investigation).toBeDefined();
    expect(ec004Record.investigation?.recommendation.action).toBe("APPROVE_MATCH");
    expect(ec004Record.investigation?.confidence).toBe("HIGH");

    // Fact 3: Human decision history is independently auditable
    expect(ec004Record.decisionHistory.length).toBe(1);
    expect(ec004Record.decisionHistory[0].action).toBe("APPROVE");
    expect(ec004Record.decisionHistory[0].reviewer.id).toBe("rev_sarah_01");

    // Fact 4: Final status is 'closed'
    expect(ec004Record.finalStatus).toBe("closed");
    expect(ec004Record.isClosed).toBe(true);

    // Render markdown report and verify all layers are present
    const markdown = formatClosePackageMarkdown(closePkg);
    expect(markdown).toContain("Autonomous Agent Investigation");
    expect(markdown).toContain("**Advisory Recommendation**: `APPROVE_MATCH`");
    expect(markdown).toContain("Human Review Decision History (1)");
    expect(markdown).toContain("rev_sarah_01");
  });

  it("deterministic mock workflow produces 100% repeatable results", async () => {
    const run1 = await runEndToEndReconciliationWorkflow();
    const run2 = await runEndToEndReconciliationWorkflow();

    expect(run1.summary).toEqual(run2.summary);
    expect(run1.reviewQueue.map((q) => q.caseId)).toEqual(run2.reviewQueue.map((q) => q.caseId));

    for (let i = 0; i < run1.investigations.length; i++) {
      const inv1 = run1.investigations[i];
      const inv2 = run2.investigations[i];
      expect(inv1.caseId).toBe(inv2.caseId);
      expect(inv1.outcome).toBe(inv2.outcome);
      expect(inv1.recommendation).toEqual(inv2.recommendation);
      expect(inv1.confidence).toBe(inv2.confidence);
      expect(inv1.riskLevel).toBe(inv2.riskLevel);
      expect(inv1.policyValidation).toEqual(inv2.policyValidation);
    }
  });

  it("agent never mutates financial records, ledger entries, or bank transactions", async () => {
    const fixture = loadFixture("month-end-reconciliation-2024.1") as any;
    const originalLedger = JSON.parse(JSON.stringify(fixture.ledgerEntries));
    const originalBankTx = JSON.parse(JSON.stringify(fixture.bankTransactions));

    await runEndToEndReconciliationWorkflow();

    // Reload fixture from disk and verify byte-for-byte integrity
    const freshFixture = loadFixture("month-end-reconciliation-2024.1") as any;
    expect(freshFixture.ledgerEntries).toEqual(originalLedger);
    expect(freshFixture.bankTransactions).toEqual(originalBankTx);
  });
});
