// tests/unit/matcher.test.ts
// Unit tests for the deterministic bank transaction candidate matcher.

import { describe, it, expect } from "vitest";
import { matchBankTransaction } from "../../src/reconciliation/matcher";
import { BankTransaction } from "../../src/schemas/bank-transaction";
import { LedgerEntry } from "../../src/schemas/ledger-entry";
import { loadFixture } from "../../src/schemas/fixture-loader";

describe("Deterministic Candidate Matcher", () => {
  const baseBankTx: BankTransaction = {
    id: "BT-TEST-001",
    accountId: "Acct123",
    transactionDate: "2024-01-15",
    postedDate: "2024-01-15",
    amount: "1250.00",
    currency: "USD",
    direction: "debit",
    description: "Payment to Vendor A",
    counterparty: "Vendor A",
    reference: "INV-001",
    source: "synthetic_bank",
    sourceRecordId: "BT-TEST-001",
    schemaVersion: "1",
    ingestedAt: "2024-01-30T09:00:00Z",
    rawHash: "hash-bt-001",
  };

  const baseLedgerEntry: LedgerEntry = {
    id: "LE-TEST-001",
    accountId: "Acct123",
    entryDate: "2024-01-15",
    postingDate: "2024-01-15",
    debit: "1250.00",
    credit: "0.00",
    currency: "USD",
    vendor: "Vendor A",
    memo: "Invoice INV-001 payment",
    reference: "INV-001",
    documentIds: ["SD001"],
    source: "synthetic_ledger",
    sourceRecordId: "LE-TEST-001",
    schemaVersion: "1",
    ingestedAt: "2024-01-30T09:00:00Z",
    rawHash: "hash-le-001",
  };

  describe("Exact Match", () => {
    it("matches single candidate with exact amount, reference, and date", () => {
      const result = matchBankTransaction(baseBankTx, [baseLedgerEntry]);

      expect(result.status).toBe("exact_match");
      expect(result.selectedMatch?.id).toBe("LE-TEST-001");
      expect(result.requiresReview).toBe(false);
      expect(result.confidence).toBe("high");
      expect(result.amountDifference).toBe("0.00");
      expect(result.candidateLedgerEntryIds).toEqual(["LE-TEST-001"]);
      expect(result.matchedLedgerEntryIds).toEqual(["LE-TEST-001"]);

      // Verify transparent rule trace
      const exactStep = result.ruleTrace.find((t) => t.rule === "exact_match_rule");
      expect(exactStep).toBeDefined();
      expect(exactStep?.passed).toBe(true);
    });

    it("matches when reference has different casing or surrounding whitespace", () => {
      const bankTx = { ...baseBankTx, reference: "  inv-001  " };
      const ledger = { ...baseLedgerEntry, reference: "INV-001" };
      const result = matchBankTransaction(bankTx, [ledger]);

      expect(result.status).toBe("exact_match");
      expect(result.selectedMatch?.id).toBe(ledger.id);
    });
  });

  describe("Amount Mismatch", () => {
    it("identifies candidate with matching reference and date but different amounts", () => {
      const bankTx = { ...baseBankTx, amount: "2500.00", reference: "INV-003" };
      const ledger = { ...baseLedgerEntry, debit: "2750.00", reference: "INV-003" };

      const result = matchBankTransaction(bankTx, [ledger]);

      expect(result.status).toBe("amount_mismatch");
      expect(result.selectedMatch?.id).toBe(ledger.id);
      expect(result.amountDifference).toBe("250.00");
      expect(result.requiresReview).toBe(true);
      expect(result.confidence).toBe("low");

      const mismatchStep = result.ruleTrace.find((t) => t.rule === "amount_mismatch_rule");
      expect(mismatchStep).toBeDefined();
      expect(mismatchStep?.details.amountDifference).toBe("250.00");
    });
  });

  describe("Timing Difference", () => {
    it("classifies candidate as timing difference when outside exact window but within timing window", () => {
      const bankTx = { ...baseBankTx, transactionDate: "2024-01-16" }; // 1 day after ledger date 2024-01-15
      const result = matchBankTransaction(bankTx, [baseLedgerEntry], { exactDateWindowDays: 0, timingDateWindowDays: 30 });

      expect(result.status).toBe("timing_difference");
      expect(result.selectedMatch?.id).toBe(baseLedgerEntry.id);
      expect(result.requiresReview).toBe(true);
      expect(result.confidence).toBe("medium");

      const timingStep = result.ruleTrace.find((t) => t.rule === "timing_difference_rule");
      expect(timingStep).toBeDefined();
      expect(timingStep?.details.dateDifferenceDays).toBe(1);
    });
  });

  describe("Ambiguous Candidates", () => {
    it("routes to human review and refuses auto-resolve when multiple exact candidates exist", () => {
      const ledgerA: LedgerEntry = { ...baseLedgerEntry, id: "LE-A", rawHash: "hash-a" };
      const ledgerB: LedgerEntry = { ...baseLedgerEntry, id: "LE-B", rawHash: "hash-b" };

      const result = matchBankTransaction(baseBankTx, [ledgerA, ledgerB]);

      expect(result.status).toBe("ambiguous_candidates");
      expect(result.selectedMatch).toBeUndefined();
      expect(result.requiresReview).toBe(true);
      expect(result.confidence).toBe("low");
      expect(result.candidateLedgerEntryIds).toContain("LE-A");
      expect(result.candidateLedgerEntryIds).toContain("LE-B");
      expect(result.matchedLedgerEntryIds).toHaveLength(0);

      const ambiguousStep = result.ruleTrace.find((t) => t.rule === "ambiguous_exact_candidates");
      expect(ambiguousStep).toBeDefined();
    });

    it("refuses to auto-resolve duplicate candidates", () => {
      const entry1: LedgerEntry = { ...baseLedgerEntry, id: "DUP-1", reference: "INV-DUP" };
      const entry2: LedgerEntry = { ...baseLedgerEntry, id: "DUP-2", reference: "INV-DUP" };
      const bankTx = { ...baseBankTx, reference: "INV-DUP" };

      const result = matchBankTransaction(bankTx, [entry1, entry2]);
      expect(result.status).toBe("ambiguous_candidates");
      expect(result.requiresReview).toBe(true);
      expect(result.selectedMatch).toBeUndefined();
    });
  });

  describe("Unmatched Transaction (No Candidate)", () => {
    it("returns no_candidate when account has no entries", () => {
      const bankTx = { ...baseBankTx, accountId: "AcctEmpty" };
      const result = matchBankTransaction(bankTx, [baseLedgerEntry]);

      expect(result.status).toBe("no_candidate");
      expect(result.selectedMatch).toBeUndefined();
      expect(result.candidates).toHaveLength(0);
      expect(result.requiresReview).toBe(true);

      const filterStep = result.ruleTrace.find((t) => t.rule === "account_currency_filter");
      expect(filterStep?.passed).toBe(false);
    });

    it("returns no_candidate when entries are in different currency", () => {
      const bankTx = { ...baseBankTx, currency: "EUR" };
      const result = matchBankTransaction(bankTx, [baseLedgerEntry]);

      expect(result.status).toBe("no_candidate");
      expect(result.candidates).toHaveLength(0);
    });
  });

  describe("Integration with Synthetic Fixture 2024.1", () => {
    const fixture = loadFixture("month-end-reconciliation-2024.1") as any;
    const bankTxs: BankTransaction[] = fixture.bankTransactions;
    const ledgerEntries: LedgerEntry[] = fixture.ledgerEntries;

    it("BT001: matches LE001 exactly", () => {
      const bt001 = bankTxs.find((b) => b.id === "BT001")!;
      const result = matchBankTransaction(bt001, ledgerEntries);

      expect(result.status).toBe("exact_match");
      expect(result.selectedMatch?.id).toBe("LE001");
      expect(result.requiresReview).toBe(false);
      expect(result.confidence).toBe("high");
    });

    it("BT002: yields no candidate (Acct456 has no ledger entries)", () => {
      const bt002 = bankTxs.find((b) => b.id === "BT002")!;
      const result = matchBankTransaction(bt002, ledgerEntries);

      expect(result.status).toBe("no_candidate");
      expect(result.selectedMatch).toBeUndefined();
      expect(result.requiresReview).toBe(true);
    });

    it("BT003: detects amount mismatch with LE003", () => {
      const bt003 = bankTxs.find((b) => b.id === "BT003")!;
      const result = matchBankTransaction(bt003, ledgerEntries);

      expect(result.status).toBe("amount_mismatch");
      expect(result.selectedMatch?.id).toBe("LE003");
      expect(result.amountDifference).toBe("250.00");
      expect(result.requiresReview).toBe(true);
    });

    it("BT004: detects timing difference with LE001", () => {
      const bt004 = bankTxs.find((b) => b.id === "BT004")!;
      const result = matchBankTransaction(bt004, ledgerEntries);

      expect(result.status).toBe("timing_difference");
      expect(result.selectedMatch?.id).toBe("LE001");
      expect(result.requiresReview).toBe(true);
      expect(result.amountDifference).toBe("0.00");
    });

    it("BT005: flags ambiguous candidates due to duplicates (INV-005)", () => {
      const bt005 = bankTxs.find((b) => b.id === "BT005")!;
      const result = matchBankTransaction(bt005, ledgerEntries);

      expect(result.status).toBe("ambiguous_candidates");
      expect(result.selectedMatch).toBeUndefined();
      expect(result.requiresReview).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(1);
    });

    it("BT006: matches candidate LE004 (missing documentation is handled separately in Phase 2B)", () => {
      const bt006 = bankTxs.find((b) => b.id === "BT006")!;
      const result = matchBankTransaction(bt006, ledgerEntries);

      // Matcher matches LE004 on amount ($300.00), ref (INV-006), date (2024-01-22)
      expect(result.candidateLedgerEntryIds).toContain("LE004");
      expect(result.selectedMatch?.id).toBe("LE004");
    });

    it("BT008: flags ambiguous candidates for LE008a and LE008b", () => {
      const bt008 = bankTxs.find((b) => b.id === "BT008")!;
      const result = matchBankTransaction(bt008, ledgerEntries);

      expect(result.status).toBe("ambiguous_candidates");
      expect(result.selectedMatch).toBeUndefined();
      expect(result.requiresReview).toBe(true);
      expect(result.candidateLedgerEntryIds).toContain("LE008a");
      expect(result.candidateLedgerEntryIds).toContain("LE008b");
    });
  });
});
