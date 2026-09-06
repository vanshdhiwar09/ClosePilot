// tests/unit/exceptions.test.ts
// Unit tests for the 6 canonical exception types and evidence collection.

import { describe, it, expect } from "vitest";
import { classifyExceptions } from "../../src/reconciliation/exceptions";
import { MatchResult } from "../../src/reconciliation/types";
import { BankTransaction } from "../../src/schemas/bank-transaction";
import { LedgerEntry } from "../../src/schemas/ledger-entry";
import { SupportingDocument } from "../../src/schemas/supporting-document";
import { DuplicateGroup } from "../../src/reconciliation/duplicates";
import { AccountBaseline } from "../../src/reconciliation/anomaly";
import { exceptionSchema } from "../../src/schemas/exception";
import { evidenceItemSchema } from "../../src/schemas/evidence-item";

describe("Deterministic Exception Classification & Evidence", () => {
  const bankTx: BankTransaction = {
    id: "BT-100",
    accountId: "Acct123",
    transactionDate: "2024-01-15",
    amount: "1250.00",
    currency: "USD",
    direction: "debit",
    description: "Invoice payment",
    reference: "INV-100",
    source: "synthetic_bank",
    sourceRecordId: "BT-100",
    schemaVersion: "1",
    ingestedAt: "2024-01-30T09:00:00Z",
    rawHash: "hash-bt-100",
  };

  const ledgerEntry: LedgerEntry = {
    id: "LE-100",
    accountId: "Acct123",
    entryDate: "2024-01-15",
    debit: "1250.00",
    credit: "0.00",
    currency: "USD",
    reference: "INV-100",
    documentIds: ["SD-100"],
    source: "synthetic_ledger",
    sourceRecordId: "LE-100",
    schemaVersion: "1",
    ingestedAt: "2024-01-30T09:00:00Z",
    rawHash: "hash-le-100",
  };

  const doc: SupportingDocument = {
    id: "SD-100",
    documentType: "invoice",
    fileName: "invoice.pdf",
    uri: "/docs/invoice.pdf",
    sha256: "hash-sd-100",
    references: ["INV-100"],
    source: "synthetic_document",
  };

  const emptyBaselines = new Map<string, AccountBaseline>();

  it("1. unmatched_transaction: generated when matchResult status is no_candidate", () => {
    const matchResult: MatchResult = {
      bankTransactionId: bankTx.id,
      status: "no_candidate",
      candidates: [],
      candidateLedgerEntryIds: [],
      matchedLedgerEntryIds: [],
      amountDifference: bankTx.amount,
      ruleTrace: [],
      confidence: "low",
      requiresReview: true,
      configVersion: "2024.1",
    };

    const result = classifyExceptions("RES-1", bankTx, matchResult, [], [], emptyBaselines);

    expect(result.overallStatus).toBe("exception");
    expect(result.autoResolutionAllowed).toBe(false);
    expect(result.exceptions).toHaveLength(1);
    expect(result.exceptions[0].type).toBe("unmatched_transaction");
    expect(() => exceptionSchema.parse(result.exceptions[0])).not.toThrow();

    // Verify evidence items validate against evidenceItemSchema
    result.evidenceItems.forEach((ev) => {
      expect(() => evidenceItemSchema.parse(ev)).not.toThrow();
    });
  });

  it("2. amount_mismatch: generated when candidate exists but amounts differ", () => {
    const matchResult: MatchResult = {
      bankTransactionId: bankTx.id,
      status: "amount_mismatch",
      selectedMatch: ledgerEntry,
      candidates: [{
        entry: ledgerEntry,
        classification: "amount_mismatch",
        amountDifference: "250.00",
        dateDifferenceDays: 0,
        referenceMatch: true,
        vendorMatch: false,
        tokenOverlap: 0,
        reasons: [],
      }],
      candidateLedgerEntryIds: [ledgerEntry.id],
      matchedLedgerEntryIds: [ledgerEntry.id],
      amountDifference: "250.00",
      ruleTrace: [],
      confidence: "low",
      requiresReview: true,
      configVersion: "2024.1",
    };

    const result = classifyExceptions("RES-2", bankTx, matchResult, [doc], [], emptyBaselines);

    expect(result.overallStatus).toBe("exception");
    expect(result.exceptions.some((e) => e.type === "amount_mismatch")).toBe(true);
    expect(result.autoResolutionAllowed).toBe(false);
  });

  it("3. timing_difference: generated when amount/reference match outside exact date window", () => {
    const matchResult: MatchResult = {
      bankTransactionId: bankTx.id,
      status: "timing_difference",
      selectedMatch: ledgerEntry,
      candidates: [{
        entry: ledgerEntry,
        classification: "timing_difference",
        amountDifference: "0.00",
        dateDifferenceDays: 2,
        referenceMatch: true,
        vendorMatch: false,
        tokenOverlap: 0,
        reasons: [],
      }],
      candidateLedgerEntryIds: [ledgerEntry.id],
      matchedLedgerEntryIds: [ledgerEntry.id],
      amountDifference: "0.00",
      ruleTrace: [],
      confidence: "medium",
      requiresReview: true,
      configVersion: "2024.1",
    };

    const result = classifyExceptions("RES-3", bankTx, matchResult, [doc], [], emptyBaselines);

    expect(result.overallStatus).toBe("exception");
    expect(result.exceptions.some((e) => e.type === "timing_difference")).toBe(true);
    expect(result.autoResolutionAllowed).toBe(false);
  });

  it("4. duplicate: generated when candidate entries belong to a duplicate cluster", () => {
    const dupGroup: DuplicateGroup<LedgerEntry> = {
      groupId: "DUP-1",
      recordType: "ledger",
      accountId: "Acct123",
      amount: "1250.00",
      reference: "INV-100",
      recordIds: ["LE-100", "LE-101"],
      records: [ledgerEntry],
      dateRangeDays: 1,
    };

    const matchResult: MatchResult = {
      bankTransactionId: bankTx.id,
      status: "ambiguous_candidates",
      candidates: [{
        entry: ledgerEntry,
        classification: "exact",
        amountDifference: "0.00",
        dateDifferenceDays: 0,
        referenceMatch: true,
        vendorMatch: false,
        tokenOverlap: 0,
        reasons: [],
      }],
      candidateLedgerEntryIds: ["LE-100"],
      matchedLedgerEntryIds: [],
      amountDifference: "0.00",
      ruleTrace: [],
      confidence: "low",
      requiresReview: true,
      configVersion: "2024.1",
    };

    const result = classifyExceptions("RES-4", bankTx, matchResult, [doc], [dupGroup], emptyBaselines);

    expect(result.overallStatus).toBe("exception");
    expect(result.exceptions.some((e) => e.type === "duplicate")).toBe(true);
  });

  it("5. missing_documentation: generated when entry has empty documentIds", () => {
    const entryWithoutDocs: LedgerEntry = {
      ...ledgerEntry,
      documentIds: [],
    };

    const matchResult: MatchResult = {
      bankTransactionId: bankTx.id,
      status: "exact_match",
      selectedMatch: entryWithoutDocs,
      candidates: [{
        entry: entryWithoutDocs,
        classification: "exact",
        amountDifference: "0.00",
        dateDifferenceDays: 0,
        referenceMatch: true,
        vendorMatch: false,
        tokenOverlap: 0,
        reasons: [],
      }],
      candidateLedgerEntryIds: [entryWithoutDocs.id],
      matchedLedgerEntryIds: [entryWithoutDocs.id],
      amountDifference: "0.00",
      ruleTrace: [],
      confidence: "high",
      requiresReview: false,
      configVersion: "2024.1",
    };

    const result = classifyExceptions("RES-5", bankTx, matchResult, [], [], emptyBaselines);

    expect(result.overallStatus).toBe("exception");
    expect(result.exceptions.some((e) => e.type === "missing_documentation")).toBe(true);
    expect(result.autoResolutionAllowed).toBe(false);
  });

  it("6. potential_anomaly: generated when transaction amount exceeds account baseline", () => {
    const largeTx: BankTransaction = {
      ...bankTx,
      amount: "15000.00",
    };

    const baselines = new Map<string, AccountBaseline>();
    baselines.set("Acct123", {
      accountId: "Acct123",
      sampleCount: 5,
      medianCents: 100000n,
      medianFormatted: "1000.00",
      thresholdCents: 500000n, // $5,000 threshold
      thresholdFormatted: "5000.00",
      basis: "dataset_median_multiplier",
    });

    const matchResult: MatchResult = {
      bankTransactionId: largeTx.id,
      status: "exact_match",
      selectedMatch: ledgerEntry,
      candidates: [{
        entry: ledgerEntry,
        classification: "exact",
        amountDifference: "0.00",
        dateDifferenceDays: 0,
        referenceMatch: true,
        vendorMatch: false,
        tokenOverlap: 0,
        reasons: [],
      }],
      candidateLedgerEntryIds: [ledgerEntry.id],
      matchedLedgerEntryIds: [ledgerEntry.id],
      amountDifference: "0.00",
      ruleTrace: [],
      confidence: "high",
      requiresReview: false,
      configVersion: "2024.1",
    };

    const result = classifyExceptions("RES-6", largeTx, matchResult, [doc], [], baselines);

    expect(result.overallStatus).toBe("exception");
    expect(result.exceptions.some((e) => e.type === "potential_anomaly")).toBe(true);
    expect(result.autoResolutionAllowed).toBe(false);
  });

  it("Exact match with documentation and no anomaly auto-resolves cleanly", () => {
    const matchResult: MatchResult = {
      bankTransactionId: bankTx.id,
      status: "exact_match",
      selectedMatch: ledgerEntry,
      candidates: [{
        entry: ledgerEntry,
        classification: "exact",
        amountDifference: "0.00",
        dateDifferenceDays: 0,
        referenceMatch: true,
        vendorMatch: false,
        tokenOverlap: 0,
        reasons: [],
      }],
      candidateLedgerEntryIds: [ledgerEntry.id],
      matchedLedgerEntryIds: [ledgerEntry.id],
      amountDifference: "0.00",
      ruleTrace: [],
      confidence: "high",
      requiresReview: false,
      configVersion: "2024.1",
    };

    const result = classifyExceptions("RES-CLEAN", bankTx, matchResult, [doc], [], emptyBaselines);

    expect(result.overallStatus).toBe("matched");
    expect(result.exceptions).toHaveLength(0);
    expect(result.autoResolutionAllowed).toBe(true);
  });
});
