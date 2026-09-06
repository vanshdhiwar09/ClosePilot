// tests/unit/investigation-tools.test.ts
// Unit tests for ClosePilot read-only investigation tools and toolbox execution tracking.

import { describe, it, expect } from "vitest";
import { ReadOnlyInvestigationToolbox, InvestigationContext } from "../../src/agent/tools";
import { BankTransaction } from "../../src/schemas/bank-transaction";
import { LedgerEntry } from "../../src/schemas/ledger-entry";
import { SupportingDocument } from "../../src/schemas/supporting-document";
import { ReconcileTransactionOutput } from "../../src/reconciliation/pipeline";
import { HumanReviewSession } from "../../src/review/state-machine";

describe("ReadOnlyInvestigationToolbox", () => {
  const mockBankTx: BankTransaction = {
    id: "BT001",
    accountId: "Acct123",
    transactionDate: "2024-01-15",
    amount: "1250.00",
    currency: "USD",
    direction: "debit",
    description: "Invoice payment to Vendor A",
    counterparty: "Vendor A",
    reference: "INV-001",
    source: "synthetic_bank",
    sourceRecordId: "SRC-BT001",
    schemaVersion: "1",
    ingestedAt: "2024-01-15T00:00:00Z",
    rawHash: "hash_bt001",
  };

  const mockLedgerEntry: LedgerEntry = {
    id: "LE001",
    accountId: "Acct123",
    entryDate: "2024-01-15",
    debit: "1250.00",
    credit: "0.00",
    currency: "USD",
    vendor: "Vendor A",
    memo: "Vendor A Invoice",
    reference: "INV-001",
    documentIds: ["SD001"],
    source: "synthetic_ledger",
    sourceRecordId: "SRC-LE001",
    schemaVersion: "1",
    ingestedAt: "2024-01-15T00:00:00Z",
    rawHash: "hash_le001",
  };

  const mockDoc: SupportingDocument = {
    id: "SD001",
    documentType: "invoice",
    fileName: "invoice_vendor_a.pdf",
    uri: "file:///data/docs/invoice_vendor_a.pdf",
    sha256: "sha256_sd001",
    vendor: "Vendor A",
    amount: "1250.00",
    currency: "USD",
    documentDate: "2024-01-15",
    references: ["INV-001"],
    source: "synthetic_document",
  };

  const mockReconcileOutput: ReconcileTransactionOutput = {
    result: {
      id: "RES-BT001",
      bankTransactionId: "BT001",
      candidateLedgerEntryIds: ["LE001"],
      matchedLedgerEntryIds: ["LE001"],
      status: "matched",
      matchMethod: "exact_match",
      confidence: "high",
      amountDifference: "0.00",
      evidenceIds: ["EV-001"],
      exceptionIds: [],
      workflowVersion: "2024.1",
      createdAt: "2024-01-15T00:00:00Z",
    },
    exceptions: [],
    evidence: [
      {
        id: "EV-001",
        kind: "source_record",
        subjectType: "result",
        subjectId: "RES-BT001",
        payload: { type: "bank_record" },
        createdAt: "2024-01-15T00:00:00Z",
      },
    ],
    autoResolutionAllowed: true,
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
          description: "Matched amount and reference",
          passed: true,
          details: {},
        },
      ],
      confidence: "high",
      requiresReview: false,
      configVersion: "2024.1",
    },
  };

  const createContext = (): InvestigationContext => {
    const reconcileOutputs = new Map<string, ReconcileTransactionOutput>();
    reconcileOutputs.set("BT001", mockReconcileOutput);

    const caseBankTxMap = new Map<string, string>();
    caseBankTxMap.set("EC001", "BT001");

    return {
      bankTransactions: [mockBankTx],
      ledgerEntries: [mockLedgerEntry],
      documents: [mockDoc],
      reconcileOutputs,
      caseBankTxMap,
    };
  };

  it("get_case retrieves complete grounded case details and records tool call", () => {
    const ctx = createContext();
    const toolbox = new ReadOnlyInvestigationToolbox(ctx);

    const caseDetail = toolbox.get_case("EC001");

    expect(caseDetail.caseId).toBe("EC001");
    expect(caseDetail.bankTransaction.id).toBe("BT001");
    expect(caseDetail.reconciliationResult.status).toBe("matched");
    expect(caseDetail.candidateLedgerEntries).toHaveLength(1);
    expect(caseDetail.candidateLedgerEntries[0].id).toBe("LE001");
    expect(caseDetail.evidence).toHaveLength(1);
    expect(caseDetail.ruleTrace).toHaveLength(1);

    const calls = toolbox.getRecordedToolCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].toolName).toBe("get_case");
    expect(calls[0].input).toEqual({ caseId: "EC001" });
    expect(calls[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("get_case throws explicit error when case is not found", () => {
    const ctx = createContext();
    const toolbox = new ReadOnlyInvestigationToolbox(ctx);

    expect(() => toolbox.get_case("NONEXISTENT")).toThrow("not found");
  });

  it("get_evidence retrieves all evidence or filters by requested IDs with validation", () => {
    const ctx = createContext();
    const toolbox = new ReadOnlyInvestigationToolbox(ctx);

    // Retrieve all
    const allEvidence = toolbox.get_evidence("EC001");
    expect(allEvidence).toHaveLength(1);
    expect(allEvidence[0].id).toBe("EV-001");

    // Retrieve specific
    const specific = toolbox.get_evidence("EC001", ["EV-001"]);
    expect(specific).toHaveLength(1);

    // Fails on nonexistent evidence ID
    expect(() => toolbox.get_evidence("EC001", ["EV-NONEXISTENT"])).toThrow(
      'Requested evidence ID "EV-NONEXISTENT" not found'
    );
  });

  it("get_ledger_entry retrieves entry and linked supporting documents", () => {
    const ctx = createContext();
    const toolbox = new ReadOnlyInvestigationToolbox(ctx);

    const result = toolbox.get_ledger_entry("LE001");
    expect(result.entry.id).toBe("LE001");
    expect(result.linkedDocuments).toHaveLength(1);
    expect(result.linkedDocuments[0].fileName).toBe("invoice_vendor_a.pdf");

    expect(() => toolbox.get_ledger_entry("LE-UNKNOWN")).toThrow("not found");
  });

  it("get_related_transactions searches related ledger entries using existing deterministic logic", () => {
    const ctx = createContext();
    const toolbox = new ReadOnlyInvestigationToolbox(ctx);

    const related = toolbox.get_related_transactions("EC001", {
      searchByVendor: true,
      dateWindowDays: 10,
    });

    expect(related.bankTransactionId).toBe("BT001");
    expect(related.relatedLedgerCount).toBe(1);
    expect(related.relatedLedgerEntries[0].entry.id).toBe("LE001");
    expect(related.relatedLedgerEntries[0].vendorMatch).toBe(true);
    expect(related.relatedLedgerEntries[0].amountDifference).toBe("0.00");
  });

  it("get_case_history retrieves decisions from review session", () => {
    const ctx = createContext();
    const reviewSession = new HumanReviewSession([
      {
        caseId: "EC002",
        bankTransaction: { ...mockBankTx, id: "BT002" },
        reconciliationOutput: {
          ...mockReconcileOutput,
          autoResolutionAllowed: false,
          result: { ...mockReconcileOutput.result, status: "review_required" },
        },
      },
    ]);

    reviewSession.applyAction({
      caseId: "EC002",
      action: "REQUEST_EVIDENCE",
      reviewer: { id: "REV-01" },
      reason: "Need documentation",
    });

    ctx.reviewSession = reviewSession;
    const toolbox = new ReadOnlyInvestigationToolbox(ctx);

    const history = toolbox.get_case_history("EC002");
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe("REQUEST_EVIDENCE");
  });

  it("demonstrates strict non-mutation: financial state remains identical after tool calls", () => {
    const ctx = createContext();
    const originalAmount = mockBankTx.amount;
    const originalDebit = mockLedgerEntry.debit;
    const toolbox = new ReadOnlyInvestigationToolbox(ctx);

    toolbox.get_case("EC001");
    toolbox.get_evidence("EC001");
    toolbox.get_ledger_entry("LE001");
    toolbox.get_related_transactions("EC001");

    expect(mockBankTx.amount).toBe(originalAmount);
    expect(mockLedgerEntry.debit).toBe(originalDebit);
  });
});
