// tests/unit/duplicates.test.ts
// Unit tests for deterministic duplicate detection.

import { describe, it, expect } from "vitest";
import { detectLedgerDuplicates, detectBankDuplicates } from "../../src/reconciliation/duplicates";
import { LedgerEntry } from "../../src/schemas/ledger-entry";
import { BankTransaction } from "../../src/schemas/bank-transaction";

describe("Deterministic Duplicate Detection", () => {
  const baseEntry: LedgerEntry = {
    id: "LE-1",
    accountId: "Acct123",
    entryDate: "2024-01-28",
    debit: "500.00",
    credit: "0.00",
    currency: "USD",
    vendor: "Vendor E",
    memo: "Invoice INV-005 payment",
    reference: "INV-005",
    source: "synthetic_ledger",
    sourceRecordId: "LE-1",
    schemaVersion: "1",
    ingestedAt: "2024-01-30T09:00:00Z",
    rawHash: "hash-1",
  };

  it("detects duplicates sharing account, amount, and reference within date tolerance", () => {
    const entryA: LedgerEntry = { ...baseEntry, id: "LE-A", entryDate: "2024-01-28" };
    const entryB: LedgerEntry = { ...baseEntry, id: "LE-B", entryDate: "2024-01-29" }; // 1 day diff

    const duplicates = detectLedgerDuplicates([entryA, entryB], { dateToleranceDays: 2 });

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].recordIds).toEqual(["LE-A", "LE-B"]);
    expect(duplicates[0].amount).toBe("500.00");
    expect(duplicates[0].reference).toBe("INV-005");
    expect(duplicates[0].dateRangeDays).toBe(1);
  });

  it("does not flag entries with different amounts as duplicates", () => {
    const entryA: LedgerEntry = { ...baseEntry, id: "LE-A", debit: "500.00" };
    const entryB: LedgerEntry = { ...baseEntry, id: "LE-B", debit: "600.00" };

    const duplicates = detectLedgerDuplicates([entryA, entryB]);
    expect(duplicates).toHaveLength(0);
  });

  it("does not flag entries with dates exceeding tolerance", () => {
    const entryA: LedgerEntry = { ...baseEntry, id: "LE-A", entryDate: "2024-01-01" };
    const entryB: LedgerEntry = { ...baseEntry, id: "LE-B", entryDate: "2024-01-10" }; // 9 days diff

    const duplicates = detectLedgerDuplicates([entryA, entryB], { dateToleranceDays: 2 });
    expect(duplicates).toHaveLength(0);
  });

  it("detects bank transaction duplicates", () => {
    const txA: BankTransaction = {
      id: "BT-A",
      accountId: "Acct123",
      transactionDate: "2024-01-15",
      amount: "100.00",
      currency: "USD",
      direction: "debit",
      description: "Test fee",
      reference: "FEE-01",
      source: "synthetic_bank",
      sourceRecordId: "BT-A",
      schemaVersion: "1",
      ingestedAt: "2024-01-30T09:00:00Z",
      rawHash: "hash-a",
    };
    const txB: BankTransaction = {
      ...txA,
      id: "BT-B",
      transactionDate: "2024-01-16",
    };

    const duplicates = detectBankDuplicates([txA, txB]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].recordIds).toEqual(["BT-A", "BT-B"]);
  });
});
