// tests/unit/ui-input-session.test.ts
// Focused unit tests for Phase 7C Input Session Layer:
// - loading the demo fixture
// - valid JSON input validation
// - invalid JSON / schema input validation
// - session reset behavior
// - workflow execution from loaded data

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateReconciliationJSON,
  startReconciliationSession,
  resetReconciliationSession,
  getWorkflowState,
  buildOverviewViewModel,
  getExceptionCases,
  getEvidenceDocuments,
  getClosePackageViewModel,
} from "../../src/ui/adapter/data-adapter";
import fixtureData from "../../data/fixtures/month-end-reconciliation-2024.1.json";

describe("Phase 7C: Input Session Layer & Reconciliation Execution", () => {
  beforeEach(() => {
    resetReconciliationSession();
  });

  describe("1. Validation: validateReconciliationJSON", () => {
    it("validates the built-in demo fixture successfully", () => {
      const result = validateReconciliationJSON(fixtureData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary).toBeDefined();
      expect(result.summary?.bankTransactionCount).toBe(8);
      expect(result.summary?.ledgerEntryCount).toBe(10);
      expect(result.summary?.documentCount).toBe(5);
      expect(result.data).toBeDefined();
    });

    it("validates a serialized JSON string containing valid reconciliation data", () => {
      const jsonStr = JSON.stringify(fixtureData);
      const result = validateReconciliationJSON(jsonStr);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary?.bankTransactionCount).toBe(8);
    });

    it("rejects invalid JSON syntax gracefully", () => {
      const invalidSyntax = "{\n  \"bankTransactions\": [ broken json ...";
      const result = validateReconciliationJSON(invalidSyntax);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Invalid JSON syntax");
    });

    it("rejects non-object or array top-level JSON", () => {
      const result = validateReconciliationJSON([1, 2, 3]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Reconciliation dataset must be a valid JSON object.");
    });

    it("rejects dataset missing bankTransactions or with empty array", () => {
      const invalidData = {
        ledgerEntries: fixtureData.ledgerEntries,
      };
      const result = validateReconciliationJSON(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("'bankTransactions'"))).toBe(true);
    });

    it("rejects dataset missing ledgerEntries or with empty array", () => {
      const invalidData = {
        bankTransactions: fixtureData.bankTransactions,
      };
      const result = validateReconciliationJSON(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("'ledgerEntries'"))).toBe(true);
    });

    it("rejects bank transaction records with invalid schema fields", () => {
      const invalidData = {
        bankTransactions: [
          {
            id: "BT999",
            // missing amount, transactionDate, etc.
            description: "Missing required fields",
          },
        ],
        ledgerEntries: fixtureData.ledgerEntries,
      };
      const result = validateReconciliationJSON(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("bankTransactions[0]"))).toBe(true);
    });

    it("rejects ledger entries with invalid debit/credit formats", () => {
      const invalidData = {
        bankTransactions: fixtureData.bankTransactions,
        ledgerEntries: [
          {
            id: "LE999",
            accountId: "1010",
            entryDate: "2024-01-15",
            debit: "NOT_AN_AMOUNT",
            credit: "0.00",
            reference: "REF",
            description: "Bad entry",
          },
        ],
      };
      const result = validateReconciliationJSON(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("ledgerEntries[0]"))).toBe(true);
    });
  });

  describe("2. Loading Demo Dataset & Workflow Execution", () => {
    it("loads the demo fixture and runs full reconciliation workflow", async () => {
      const state = await startReconciliationSession();

      expect(state).toBeDefined();
      expect(state.workflowResult).toBeDefined();
      expect(state.workflowResult.session).toBeDefined();
      expect(state.workflowResult.closePackage).toBeDefined();
      expect(state.workflowResult.summary).toBeDefined();

      // Check cases were properly created
      const cases = state.workflowResult.closePackage.cases;
      expect(cases.length).toBe(8);

      // Verify overview view model builds cleanly
      const overview = buildOverviewViewModel(state);
      expect(overview.financials.bankTransactionsCount).toBe(8);
      expect(overview.financials.ledgerEntriesCount).toBe(10);
      expect(overview.period.periodName).toBe("January 2024 Close (2024.1)");
    });
  });

  describe("3. Loading Custom Valid Dataset & Workflow Execution", () => {
    it("runs reconciliation workflow on uploaded custom dataset", async () => {
      // Create a valid dataset conforming to ClosePilot reconciliation JSON schema
      const customDataset = {
        fixtureVersion: "custom-test-2024",
        description: "Custom Client-Side Uploaded Reconciliation",
        bankTransactions: [
          {
            ...fixtureData.bankTransactions[0],
            id: "CUST-BT001",
            amount: "100.00",
            reference: "INV-CUST-100",
          },
          {
            ...fixtureData.bankTransactions[1],
            id: "CUST-BT002",
            amount: "250.00",
            reference: "INV-CUST-250",
          },
        ],
        ledgerEntries: [
          {
            ...fixtureData.ledgerEntries[0],
            id: "CUST-LE001",
            debit: "100.00",
            credit: "0.00",
            reference: "INV-CUST-100",
          },
          {
            ...fixtureData.ledgerEntries[1],
            id: "CUST-LE002",
            debit: "250.00",
            credit: "0.00",
            reference: "INV-CUST-250",
          },
        ],
        documents: [],
      };

      const valResult = validateReconciliationJSON(customDataset);
      expect(valResult.isValid).toBe(true);

      const state = await startReconciliationSession(
        valResult.data,
        "Custom Upload Session"
      );

      expect(state).toBeDefined();
      expect(state.workflowResult.closePackage.cases.length).toBe(2);

      const overview = buildOverviewViewModel(state);
      expect(overview.financials.bankTransactionsCount).toBe(2);
      expect(overview.financials.ledgerEntriesCount).toBe(2);
      expect(overview.period.periodName).toBe("Custom Upload Session");
    });
  });

  describe("4. Session Reset Behavior", () => {
    it("resets session state on resetReconciliationSession()", async () => {
      // 1. Start session
      const state1 = await startReconciliationSession();
      expect(state1).toBeDefined();

      // getWorkflowState should return cached session
      const cached = await getWorkflowState();
      expect(cached).toBe(state1);

      // 2. Reset session
      resetReconciliationSession();

      // 3. getWorkflowState now creates a fresh session
      const state2 = await getWorkflowState();
      expect(state2).toBeDefined();
      expect(state2).not.toBe(state1);
    });
  });

  describe("5. Custom 3-Transaction Session Isolation & Accounting Policy Enforcement", () => {
    // Custom 3-transaction test fixture:
    // BT101 = $1,200 exact match (auto-resolved)
    // BT102 = $3,500 amount mismatch (human review required)
    // BT103 = $15,000 exact match on high-value / unverified baseline (human review required)
    const custom3TxFixture = {
      fixtureVersion: "custom-3tx-dataset",
      description: "Custom Month-End Upload (3 Transactions)",
      bankTransactions: [
        {
          id: "BT101",
          accountId: "AcctDemo",
          transactionDate: "2024-01-15",
          postedDate: "2024-01-15",
          amount: "1200.00",
          currency: "USD",
          direction: "debit",
          description: "Payment to Demo Vendor A",
          counterparty: "Demo Vendor A",
          reference: "INV-DEMO-101",
          source: "uploaded",
          sourceRecordId: "BT101",
          schemaVersion: "1",
          ingestedAt: "2024-01-30T09:00:00Z",
          rawHash: "hash101",
        },
        {
          id: "BT102",
          accountId: "AcctDemo",
          transactionDate: "2024-01-18",
          postedDate: "2024-01-18",
          amount: "3500.00",
          currency: "USD",
          direction: "debit",
          description: "Payment to Demo Vendor B with discrepancy",
          counterparty: "Demo Vendor B",
          reference: "INV-DEMO-102",
          source: "uploaded",
          sourceRecordId: "BT102",
          schemaVersion: "1",
          ingestedAt: "2024-01-30T09:05:00Z",
          rawHash: "hash102",
        },
        {
          id: "BT103",
          accountId: "AcctDemo",
          transactionDate: "2024-01-20",
          postedDate: "2024-01-20",
          amount: "15000.00",
          currency: "USD",
          direction: "debit",
          description: "High-value demo payment to Vendor C",
          counterparty: "Large Demo Vendor C",
          reference: "LARGE-DEMO-001",
          source: "uploaded",
          sourceRecordId: "BT103",
          schemaVersion: "1",
          ingestedAt: "2024-01-30T09:10:00Z",
          rawHash: "hash103",
        },
      ],
      ledgerEntries: [
        {
          id: "LE101",
          accountId: "AcctDemo",
          entryDate: "2024-01-15",
          debit: "1200.00",
          credit: "0.00",
          currency: "USD",
          reference: "INV-DEMO-101",
          description: "Ledger entry for Vendor A",
          documentIds: ["DOC101"],
          schemaVersion: "1",
          postedAt: "2024-01-15T10:00:00Z",
        },
        {
          id: "LE102",
          accountId: "AcctDemo",
          entryDate: "2024-01-18",
          debit: "3400.00",
          credit: "0.00",
          currency: "USD",
          reference: "INV-DEMO-102",
          description: "Ledger entry for Vendor B ($100 mismatch)",
          documentIds: ["DOC102"],
          schemaVersion: "1",
          postedAt: "2024-01-18T10:00:00Z",
        },
        {
          id: "LE103",
          accountId: "AcctDemo",
          entryDate: "2024-01-20",
          debit: "15000.00",
          credit: "0.00",
          currency: "USD",
          reference: "LARGE-DEMO-001",
          description: "Ledger entry for Large Vendor C",
          documentIds: ["DOC103"],
          schemaVersion: "1",
          postedAt: "2024-01-20T10:00:00Z",
        },
      ],
      documents: [
        {
          id: "DOC101",
          documentType: "invoice",
          fileName: "invoice-demo-101.pdf",
          schemaVersion: "1",
          uploadedAt: "2024-01-15T09:00:00Z",
          rawHash: "dochash101",
        },
        {
          id: "DOC102",
          documentType: "invoice",
          fileName: "invoice-demo-102.pdf",
          schemaVersion: "1",
          uploadedAt: "2024-01-18T09:00:00Z",
          rawHash: "dochash102",
        },
        {
          id: "DOC103",
          documentType: "invoice",
          fileName: "invoice-demo-103.pdf",
          schemaVersion: "1",
          uploadedAt: "2024-01-20T09:00:00Z",
          rawHash: "dochash103",
        },
      ],
      chartOfAccounts: [
        {
          accountId: "AcctDemo",
          accountCode: "1050",
          accountName: "Demo Operating Account",
          accountType: "asset",
          active: true,
          currency: "USD",
        },
      ],
    };

    // A. Canonical fixture still produces its existing expected results
    it("A: verifies canonical fixture produces existing baseline results (8 cases, 1 auto-resolved, 7 exceptions, 75% ground truth agreement)", async () => {
      const canonicalState = await startReconciliationSession();
      const overview = buildOverviewViewModel(canonicalState);

      expect(canonicalState.workflowResult.closePackage.cases).toHaveLength(8);
      expect(overview.kpis.autoResolvedCount).toBe(1);
      expect(overview.kpis.humanReviewCount).toBe(7);
      expect(overview.kpis.agreementAccuracy).toBe("75.0%");
      expect(overview.kpis.falseAutoCloseRate).toBe("0.0%");
      expect(overview.kpis.agreementDetail).toContain("6/8 verified agreement with ground truth");
    });

    // B. Custom 3-transaction dataset produces exactly 3 active cases
    it("B: custom 3-transaction dataset produces exactly 3 active cases corresponding to BT101, BT102, BT103", async () => {
      const state = await startReconciliationSession(custom3TxFixture, "Custom 3-Tx Upload");
      const cases = state.workflowResult.closePackage.cases;

      expect(cases).toHaveLength(3);
      const bankTxIds = cases.map((c) => c.bankTransactionId).sort();
      expect(bankTxIds).toEqual(["BT101", "BT102", "BT103"]);
    });

    // C. Canonical 8 cases do not appear in the custom session
    it("C: canonical 8 cases do not appear in the custom session", async () => {
      const state = await startReconciliationSession(custom3TxFixture, "Custom 3-Tx Upload");
      const cases = state.workflowResult.closePackage.cases;
      const bankTxIds = cases.map((c) => c.bankTransactionId);

      const canonicalIds = ["BT001", "BT002", "BT003", "BT004", "BT005", "BT006", "BT007", "BT008"];
      for (const canonicalId of canonicalIds) {
        expect(bankTxIds).not.toContain(canonicalId);
      }
    });

    // D. Overview metrics use custom session data
    it("D: overview metrics strictly use custom session data ($1,200 auto-resolved, $18,500 human review, $19,700 total)", async () => {
      const state = await startReconciliationSession(custom3TxFixture, "Custom 3-Tx Upload");
      const overview = buildOverviewViewModel(state);

      // Total cases = 3
      expect(overview.kpis.totalCases).toBe(3);
      // Auto-resolved cases = 1 (BT101)
      expect(overview.kpis.autoResolvedCount).toBe(1);
      // Human review cases = 2 (BT102 + BT103)
      expect(overview.kpis.humanReviewCount).toBe(2);
      expect(overview.kpis.humanReviewRatio).toBe("2/3");

      // Financial figures
      expect(overview.kpis.autoResolvedAmount).toBe("$1,200.00");
      expect(overview.financials.totalReconciledAmount).toBe("$1,200.00");
      expect(overview.financials.totalUnreconciledAmount).toBe("$18,500.00");

      // Record counts from uploaded dataset
      expect(overview.financials.bankTransactionsCount).toBe(3);
      expect(overview.financials.ledgerEntriesCount).toBe(3);
      expect(overview.financials.supportingDocumentsCount).toBe(3);

      // Session label reflects uploaded dataset
      expect(overview.period.periodName).toBe("Custom 3-Tx Upload");
    });

    // E. No ground-truth metric is fabricated when custom ground truth is absent
    it("E: does not fabricate a ground-truth metric when ground truth is not provided", async () => {
      const state = await startReconciliationSession(custom3TxFixture, "Custom 3-Tx Upload");
      const overview = buildOverviewViewModel(state);

      expect(overview.kpis.agreementAccuracy).toBe("N/A");
      expect(overview.kpis.agreementDetail).toBe("Ground Truth: Not provided");
      expect(overview.kpis.falseAutoCloseRate).toBe("N/A");
      expect(overview.kpis.falseAutoCloseDetail).toBe("Evaluation requires ground truth dataset");
    });

    // F. Starting a new session clears custom session state
    it("F: starting a new session resets all custom session state and restores clean defaults", async () => {
      // 1. Start custom session
      await startReconciliationSession(custom3TxFixture, "Custom 3-Tx Upload");
      const customState = await getWorkflowState();
      expect(customState.workflowResult.closePackage.cases).toHaveLength(3);

      // 2. Reset session (simulates clicking "New Close Session")
      resetReconciliationSession();

      // 3. Start demo session
      const freshState = await startReconciliationSession();
      expect(freshState.workflowResult.closePackage.cases).toHaveLength(8);
      const overview = buildOverviewViewModel(freshState);
      expect(overview.period.periodName).toBe("January 2024 Close (2024.1)");
      expect(overview.kpis.totalCases).toBe(8);
    });

    // G. Uploaded documents/ledger entries are used by the reconciliation workflow
    it("G: uploaded documents and ledger entries are used by the reconciliation workflow", async () => {
      const state = await startReconciliationSession(custom3TxFixture, "Custom 3-Tx Upload");
      const evidenceDocs = getEvidenceDocuments(state);

      expect(evidenceDocs).toHaveLength(3);
      const docIds = evidenceDocs.map((d) => d.id).sort();
      expect(docIds).toEqual(["DOC101", "DOC102", "DOC103"]);

      const closePkg = getClosePackageViewModel(state);
      expect(closePkg.totalCases).toBe(3);
      expect(closePkg.totalReconciledAmount).toBe("$1,200.00");
      expect(closePkg.totalUnreconciledAmount).toBe("$18,500.00");
    });

    // H. Anomaly/policy evaluation is not accidentally bypassed just because an exact match exists
    it("H: BT103 ($15,000) exact match is not auto-resolved without review because it exceeds high-value policy threshold", async () => {
      const state = await startReconciliationSession(custom3TxFixture, "Custom 3-Tx Upload");
      const cases = state.workflowResult.closePackage.cases;

      const bt103Case = cases.find((c) => c.bankTransactionId === "BT103");
      expect(bt103Case).toBeDefined();

      // BT103 matched LE103 exactly
      expect(bt103Case?.reconciliationResult.status).toBe("review_required");
      expect(bt103Case?.reconciliationResult.matchMethod).toBe("exact_match");

      // Auto-resolution was strictly prevented
      expect(bt103Case?.isClosed).toBe(false);
      expect(bt103Case?.humanReviewState).toBe("REVIEW_REQUIRED");

      // Human review queue includes BT103
      const reviewCases = getExceptionCases(state);
      const reviewTxIds = reviewCases.map((c) => c.bankTxId);
      expect(reviewTxIds).toContain("BT103");
      expect(reviewTxIds).toContain("BT102");
      expect(reviewTxIds).not.toContain("BT101"); // BT101 is auto-resolved
    });
  });
});
