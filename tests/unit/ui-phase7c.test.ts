// tests/unit/ui-phase7c.test.ts
// Unit tests for Phase 7C: Evidence Locker, Close Package ViewModel, and Human Review Reactivity.

import { describe, it, expect, beforeEach } from "vitest";
import {
  getWorkflowState,
  getClosePackageViewModel,
  getEvidenceLockerViewModel,
  executeReviewAction,
} from "../../src/ui/adapter/data-adapter";

describe("Phase 7C: Evidence Locker & Close Package Architecture", () => {
  let state: Awaited<ReturnType<typeof getWorkflowState>>;

  beforeEach(async () => {
    state = await getWorkflowState(true);
  });

  describe("1. EvidenceLockerViewModel", () => {
    it("contains authentic fixture documents and correct document IDs", () => {
      const locker = getEvidenceLockerViewModel(state);

      expect(locker.documents.length).toBeGreaterThanOrEqual(5);
      const docIds = locker.documents.map((d) => d.id);
      expect(docIds).toContain("SD001");
      expect(docIds).toContain("SD002");
      expect(docIds).toContain("SD003");
      expect(docIds).toContain("SD004");
      expect(docIds).toContain("SD005");

      // Verify no fake demo documents exist
      expect(docIds).not.toContain("INV-2024-001");
      expect(docIds).not.toContain("CON-VENDOR-2023");
    });

    it("surfaces generated workflow evidence from reconciliation and investigation", () => {
      const locker = getEvidenceLockerViewModel(state);

      expect(locker.generatedEvidence.length).toBeGreaterThan(0);
      const kinds = new Set(locker.generatedEvidence.map((e) => e.kind));

      // Generated evidence must include source_record, calculation, or match_rule
      expect(kinds.has("source_record")).toBe(true);
      expect(kinds.has("calculation") || kinds.has("match_rule")).toBe(true);

      // Verify evidence items have real IDs
      for (const ev of locker.generatedEvidence) {
        expect(ev.id).toMatch(/^EV-/);
        expect(ev.caseId).toBeDefined();
        expect(ev.summary).toBeDefined();
      }
    });

    it("surfaces missing documentation cases honestly, specifically EC006", () => {
      const locker = getEvidenceLockerViewModel(state);

      const missingCaseIds = locker.missingEvidenceCases.map((m) => m.caseId);
      expect(missingCaseIds).toContain("EC006");

      const ec006 = locker.missingEvidenceCases.find((m) => m.caseId === "EC006")!;
      expect(ec006.bankTxId).toBe("BT006");
      expect(ec006.amount).toBe("$300.00");
      expect(ec006.reason).toContain("no linked supporting documents");
    });
  });

  describe("2. ClosePackageViewModel Mapping & Metrics", () => {
    it("maps actual close-package data without hardcoding", () => {
      const pkgView = getClosePackageViewModel(state);

      expect(pkgView.period).toBe("2024.1");
      expect(pkgView.totalCases).toBe(8);
      expect(pkgView.automaticallyResolvedCases).toBe(1);
      expect(pkgView.unresolvedCases).toBe(7);
      expect(pkgView.approvedCases).toBe(0);
      expect(pkgView.allCasesClosed).toBe(false);

      expect(pkgView.totalReconciledAmount).toBe("$1,250.00");
      expect(pkgView.totalUnreconciledAmount).toBe("$21,300.00");

      expect(pkgView.cases.length).toBe(8);
      expect(pkgView.cases[0].caseId).toBe("EC001");
      expect(pkgView.cases[0].finalStatus).toBe("closed");
      expect(pkgView.cases[0].isClosed).toBe(true);
    });

    it("contains markdown report generated from domain formatClosePackageMarkdown", () => {
      const pkgView = getClosePackageViewModel(state);

      expect(pkgView.markdownReport).toContain("# ClosePilot Month-End Close Package");
      expect(pkgView.markdownReport).toContain("Executive Close Summary");
      expect(pkgView.markdownReport).toContain("Case-by-Case Close Ledger");
    });
  });

  describe("3. Reactive Human Review & Dynamic Close Package Updates", () => {
    it("updates close package when human approval is executed", () => {
      const initialPkg = getClosePackageViewModel(state);
      expect(initialPkg.approvedCases).toBe(0);
      expect(initialPkg.unresolvedCases).toBe(7);
      expect(initialPkg.totalReconciledAmount).toBe("$1,250.00");

      // Approve flagship case EC007 ($15,000.00) citing the anomaly calculation evidence
      executeReviewAction(state, {
        caseId: "EC007",
        action: "APPROVE",
        reason: "Approved capital expenditure after anomaly review",
        evidenceIds: ["EV-CALC-anomaly_threshold-RES-BT007"],
      });

      const updatedPkg = getClosePackageViewModel(state);
      expect(updatedPkg.approvedCases).toBe(1);
      expect(updatedPkg.unresolvedCases).toBe(6);
      expect(updatedPkg.humanReviewedCases).toBe(1);

      // Reconciled balance should increase by $15,000.00 to $16,250.00
      expect(updatedPkg.totalReconciledAmount).toBe("$16,250.00");
      expect(updatedPkg.totalUnreconciledAmount).toBe("$6,300.00");

      // Inspect case EC007 in updated package
      const ec007 = updatedPkg.cases.find((c) => c.caseId === "EC007")!;
      expect(ec007.finalStatus).toBe("closed");
      expect(ec007.isClosed).toBe(true);
      expect(ec007.decisionCount).toBe(1);
      expect(ec007.decisionHistory[0].action).toBe("APPROVE");
      expect(ec007.decisionHistory[0].reason).toContain("Approved capital expenditure");
      expect(ec007.evidenceIds).toContain("EV-CALC-anomaly_threshold-RES-BT007");
    });

    it("enforces evidence-first flow on EC006 before close package reflects resolution", () => {
      // 1. Direct approve fails
      expect(() => {
        executeReviewAction(state, {
          caseId: "EC006",
          action: "APPROVE",
          reason: "Direct approve attempt",
        });
      }).toThrow(/requires evidence/i);

      // 2. Request evidence
      executeReviewAction(state, {
        caseId: "EC006",
        action: "REQUEST_EVIDENCE",
        reason: "Requesting vendor invoice",
      });

      let pkg = getClosePackageViewModel(state);
      let ec006 = pkg.cases.find((c) => c.caseId === "EC006")!;
      expect(ec006.finalStatus).toBe("unresolved");
      expect(ec006.isClosed).toBe(false);

      // 3. Supply evidence
      const supplyDecision = executeReviewAction(state, {
        caseId: "EC006",
        action: "SUPPLY_EVIDENCE",
        reason: "Supplying verified vendor receipt",
      });

      // The supplied evidence ID was generated and attached to the case
      const suppliedEvidenceId = supplyDecision.evidenceIds[0];
      expect(suppliedEvidenceId).toBeDefined();

      // 4. Approve
      executeReviewAction(state, {
        caseId: "EC006",
        action: "APPROVE",
        reason: "Approved with attached verified invoice",
        evidenceIds: [suppliedEvidenceId],
      });

      pkg = getClosePackageViewModel(state);
      ec006 = pkg.cases.find((c) => c.caseId === "EC006")!;
      expect(ec006.finalStatus).toBe("closed");
      expect(ec006.isClosed).toBe(true);
      expect(ec006.evidenceIds).toContain(suppliedEvidenceId);

      // Reconciled amount should include $300.00
      expect(pkg.totalReconciledAmount).toBe("$1,550.00");
    });
  });
});
