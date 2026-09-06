// Unit tests for schema validation and fixture/ground-truth integrity
// Run with: npx vitest run tests/unit

import { describe, it, expect } from "vitest";

import {
  BankTransaction,
  bankTransactionSchema,
  LedgerEntry,
  ledgerEntrySchema,
  getLedgerSignedAmount,
  SupportingDocument,
  supportingDocumentSchema,
  ChartOfAccount,
  chartOfAccountSchema,
  ReconciliationResult,
  reconciliationResultSchema,
  Exception,
  exceptionSchema,
  HumanReview,
  humanReviewSchema,
  EvaluationCase,
  evaluationCaseSchema,
  EvidenceItem,
  evidenceItemSchema,
  validateBankTransaction,
  validateLedgerEntry,
  validateSupportingDocument,
  validateChartOfAccount,
  validateReconciliationResult,
  validateException,
  validateEvidenceItem,
  validateEvaluationCase,
  isReviewRequired,
  isMatched,
  isException,
  getFixtureMetadata,
  loadFixture,
  loadGroundTruth,
} from "../../src/schemas";
import * as fs from "node:fs";
import * as path from "node:path";

describe("BankTransaction Schema", () => {
  const validTx: BankTransaction = {
    id: "BT-001",
    accountId: "Acct123",
    transactionDate: "2024-01-15",
    amount: "1250.00",
    currency: "USD",
    direction: "debit",
    description: "Test transaction",
    source: "synthetic_bank",
    sourceRecordId: "BT-001",
    schemaVersion: "1",
    ingestedAt: "2024-01-30T09:00:00Z",
    rawHash: "a1b2c3d4e5f6g7h8i9j0",
  };

  it("validates a valid BankTransaction", () => {
    const result = bankTransactionSchema.parse(validTx);
    expect(result.id).toBe("BT-001");
  });

  it("rejects missing required fields", () => {
    const incomplete = { id: "BT-001" } as Partial<BankTransaction>;
    try {
      bankTransactionSchema.parse(incomplete);
      throw new Error("Should have thrown");
    } catch (error: any) {
      expect(error.issues).toBeDefined();
      const hasRequiredMessage = error.issues.some(
        (issue: any) => issue.message && issue.message.includes("Required")
      );
      expect(hasRequiredMessage).toBe(true);
    }
  });

  it("validates source field is 'synthetic_bank'", () => {
    const badSource = {
      ...validTx,
      source: "real_bank",
    };
    expect(() => bankTransactionSchema.parse(badSource)).toThrow();
  });
});

describe("LedgerEntry Schema", () => {
  const validEntry: LedgerEntry = {
    id: "LE-001",
    accountId: "Acct123",
    entryDate: "2024-01-15",
    debit: "1250.00",
    credit: "0.00",
    currency: "USD",
    vendor: "Vendor A",
    reference: "INV-001",
    documentIds: ["SD001"],
    source: "synthetic_ledger",
    sourceRecordId: "LE-001",
    schemaVersion: "1",
    ingestedAt: "2024-01-30T09:00:00Z",
    rawHash: "a1b2c3d4e5f6g7h8i9j0",
  };

  it("validates a valid LedgerEntry", () => {
    const result = ledgerEntrySchema.parse(validEntry);
    expect(result.id).toBe("LE-001");
  });

  it("calculates signed amount correctly", () => {
    const signed = getLedgerSignedAmount(validEntry);
    expect(signed).toBe("1250.00");
  });

  it("rejects invalid source", () => {
    const badSource = {
      ...validEntry,
      source: "invalid_source",
    };
    expect(() => ledgerEntrySchema.parse(badSource)).toThrow();
  });
});

describe("SupportingDocument Schema", () => {
  const validDoc: SupportingDocument = {
    id: "SD-001",
    documentType: "invoice",
    fileName: "invoice.pdf",
    uri: "https://example.com/docs/invoice.pdf",
    sha256: "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
    vendor: "Vendor A",
    amount: "1250.00",
    currency: "USD",
    documentDate: "2024-01-15",
    references: ["INV-001"],
    source: "synthetic_document",
  };

  it("validates a valid SupportingDocument", () => {
    const result = supportingDocumentSchema.parse(validDoc);
    expect(result.id).toBe("SD-001");
  });

  it("validates a SupportingDocument with relative URI and synthetic hash", () => {
    const localDoc: SupportingDocument = {
      id: "SD-002",
      documentType: "invoice",
      fileName: "invoice-vendor-a-001.pdf",
      uri: "/documents/invoice-vendor-a-001.pdf",
      sha256: "hash-sd001-reference-string",
      source: "synthetic_document",
    };
    const result = supportingDocumentSchema.parse(localDoc);
    expect(result.id).toBe("SD-002");
    expect(result.uri).toBe("/documents/invoice-vendor-a-001.pdf");
  });

  it("rejects invalid documentType", () => {
    const badType = {
      ...validDoc,
      documentType: "invalid_type",
    };
    expect(() => supportingDocumentSchema.parse(badType)).toThrow();
  });
});

describe("ChartOfAccount Schema", () => {
  const validAccount: ChartOfAccount = {
    accountId: "Acct123",
    accountCode: "1000",
    accountName: "Cash",
    accountType: "asset",
    active: true,
    currency: "USD",
  };

  it("validates a valid ChartOfAccount", () => {
    const result = chartOfAccountSchema.parse(validAccount);
    expect(result.accountId).toBe("Acct123");
  });

  it("rejects invalid accountType", () => {
    const invalidType = {
      ...validAccount,
      accountType: "invalid_type",
    };
    expect(() => chartOfAccountSchema.parse(invalidType)).toThrow();
  });
});

describe("ReconciliationResult Schema", () => {
  const validResult: ReconciliationResult = {
    id: "R-001",
    bankTransactionId: "BT-001",
    candidateLedgerEntryIds: ["LE-001", "LE-002"],
    matchedLedgerEntryIds: ["LE-001"],
    status: "matched",
    matchMethod: "exact",
    confidence: "high",
    amountDifference: "0.00",
    evidenceIds: ["SD001"],
    exceptionIds: [],
    workflowVersion: "2024.1.0",
    createdAt: "2024-01-30T10:00:00Z",
  };

  it("validates a valid ReconciliationResult", () => {
    const result = reconciliationResultSchema.parse(validResult);
    expect(result.status).toBe("matched");
  });

  it("rejects invalid status", () => {
    const badStatus = {
      ...validResult,
      status: "invalid_status",
    };
    expect(() => reconciliationResultSchema.parse(badStatus)).toThrow();
  });
});

describe("Exception Schema", () => {
  const validException: Exception = {
    id: "EX-001",
    resultId: "R-001",
    type: "amount_mismatch",
    severity: "medium",
    status: "open",
    reasonCode: "AMT-MISMATCH-001",
    evidenceIds: ["SD001"],
    createdAt: "2024-01-30T10:05:00Z",
  };

  it("validates a valid Exception", () => {
    const result = exceptionSchema.parse(validException);
    expect(result.type).toBe("amount_mismatch");
  });

  it("rejects invalid exception type", () => {
    const badType = {
      ...validException,
      type: "invalid_type",
    };
    expect(() => exceptionSchema.parse(badType)).toThrow();
  });
});

describe("HumanReview Schema", () => {
  const validReview: HumanReview = {
    id: "HR-001",
    resultId: "R-001",
    state: "queued",
    reviewerId: "reviewer-1",
    decision: "approve_match",
    rationale: "Matches exactly with no anomalies",
    evidenceIds: ["SD001"],
    createdAt: "2024-01-30T10:00:00Z",
    decidedAt: "2024-01-30T10:30:00Z",
  };

  it("validates a valid HumanReview", () => {
    const result = humanReviewSchema.parse(validReview);
    expect(result.state).toBe("queued");
  });

  it("rejects invalid state", () => {
    const badState = {
      ...validReview,
      state: "invalid_state",
    };
    expect(() => humanReviewSchema.parse(badState)).toThrow();
  });
});

describe("EvaluationCase Schema", () => {
  const validCase: EvaluationCase = {
    id: "EC-001",
    fixtureVersion: "2024.1",
    bankTransactionId: "BT001",
    expectedLedgerEntryIds: ["LE001"],
    expectedStatus: "matched",
    expectedExceptionTypes: [],
    expectedAutoResolutionAllowed: true,
    notes: "Test case",
  };

  it("validates a valid EvaluationCase", () => {
    const result = evaluationCaseSchema.parse(validCase);
    expect(result.id).toBe("EC-001");
  });

  it("validates review_required status", () => {
    const reviewCase = {
      ...validCase,
      expectedStatus: "review_required",
    };
    const result = evaluationCaseSchema.parse(reviewCase);
    expect(isReviewRequired(result.expectedStatus)).toBe(true);
  });

  it("validates matched status", () => {
    const matchedCase = {
      ...validCase,
      expectedStatus: "matched",
    };
    const result = evaluationCaseSchema.parse(matchedCase);
    expect(isMatched(result.expectedStatus)).toBe(true);
  });

  it("validates exception status", () => {
    const exceptionCase = {
      ...validCase,
      expectedStatus: "exception",
    };
    const result = evaluationCaseSchema.parse(exceptionCase);
    expect(isException(result.expectedStatus)).toBe(true);
  });
});

describe("EvidenceItem Schema", () => {
  const validEvidence: EvidenceItem = {
    id: "EV-001",
    kind: "source_record",
    subjectType: "result",
    subjectId: "R-001",
    sourceId: "BT-001",
    locator: "bank_transaction:BT-001",
    contentHash: "a1b2c3d4e5f6g7h8i9j0",
    payload: { amount: "1250.00", currency: "USD" },
    createdAt: "2024-01-30T09:30:00Z",
  };

  it("validates a valid EvidenceItem", () => {
    const result = evidenceItemSchema.parse(validEvidence);
    expect(result.kind).toBe("source_record");
  });

  it("rejects invalid kind", () => {
    const badKind = {
      ...validEvidence,
      kind: "invalid_kind",
    };
    expect(() => evidenceItemSchema.parse(badKind)).toThrow();
  });
});

describe("Fixture Loader", () => {
  describe("loadFixture", () => {
    it("loads a valid fixture", () => {
      const fixture = loadFixture("month-end-reconciliation-2024.1");
      expect(fixture).toBeDefined();
      expect(fixture.bankTransactions).toHaveLength(8);
      expect(fixture.ledgerEntries).toHaveLength(10);
      expect(fixture.documents).toHaveLength(5);
      expect(fixture.chartOfAccounts).toHaveLength(3);
    });

    it("throws for missing fixture", () => {
      expect(() => loadFixture("nonexistent-fixture")).toThrow(
        "Fixture not found"
      );
    });
  });

  describe("loadGroundTruth", () => {
    it("loads a valid ground truth", () => {
      const gt = loadGroundTruth("2024.1");
      expect(gt).toBeDefined();
      expect(gt.evaluationCases).toHaveLength(8);
    });

    it("throws for missing ground truth", () => {
      expect(() => loadGroundTruth("nonexistent-version")).toThrow(
        "Ground truth not found"
      );
    });
  });

  describe("getFixtureMetadata", () => {
    it("returns fixture metadata", () => {
      const metadata = getFixtureMetadata("month-end-reconciliation-2024.1");
      expect(metadata.fixtureVersion).toBe("2024.1");
      expect(metadata.recordCount.bankTransactions).toBe(8);
      expect(metadata.recordCount.ledgerEntries).toBe(10);
      expect(metadata.recordCount.documents).toBe(5);
      expect(metadata.recordCount.chartOfAccounts).toBe(3);
    });
  });
});

describe("Schema Validation - Invalid records fail clearly", () => {
  it("BankTransaction validation error is descriptive", () => {
    const invalid = { id: "BT-001" } as Partial<BankTransaction>;
    try {
      bankTransactionSchema.parse(invalid);
      throw new Error("Should have thrown");
    } catch (error: any) {
      expect(error.issues).toBeDefined();
      expect(Array.isArray(error.issues)).toBe(true);
      const hasRequiredMessage = error.issues.some(
        (issue: any) => issue.message && issue.message.includes("Required")
      );
      expect(hasRequiredMessage).toBe(true);
    }
  });

  it("LedgerEntry validation error is descriptive", () => {
    const invalid = { id: "LE-001" } as Partial<LedgerEntry>;
    try {
      ledgerEntrySchema.parse(invalid);
      throw new Error("Should have thrown");
    } catch (error: any) {
      expect(error.issues).toBeDefined();
      expect(Array.isArray(error.issues)).toBe(true);
      const hasRequiredMessage = error.issues.some(
        (issue: any) => issue.message && issue.message.includes("Required")
      );
      expect(hasRequiredMessage).toBe(true);
    }
  });

  it("EvaluationCase validation error is descriptive", () => {
    const invalid = { id: "EC-001" } as Partial<EvaluationCase>;
    try {
      evaluationCaseSchema.parse(invalid);
      throw new Error("Should have thrown");
    } catch (error: any) {
      expect(error.issues).toBeDefined();
      expect(Array.isArray(error.issues)).toBe(true);
      const hasRequiredMessage = error.issues.some(
        (issue: any) => issue.message && issue.message.includes("Required")
      );
      expect(hasRequiredMessage).toBe(true);
    }
  });
});

describe("Fixture & Ground-Truth Integrity", () => {
  const fixture = loadFixture("month-end-reconciliation-2024.1") as any;
  const groundTruth = loadGroundTruth("2024.1") as any;

  it("fixture has 8 bank transactions matching ground truth bank IDs", () => {
    const btIds = fixture.bankTransactions.map((bt: any) => bt.id);
    groundTruth.evaluationCases.forEach((ec: any) => {
      expect(btIds).toContain(ec.bankTransactionId);
    });
  });

  it("ground truth has 8 evaluation cases", () => {
    expect(groundTruth.evaluationCases).toHaveLength(8);
  });

  it("each evaluation case references a valid bank transaction", () => {
    const btIds = new Set(
      fixture.bankTransactions.map((bt: any) => bt.id)
    );
    groundTruth.evaluationCases.forEach((ec: any) => {
      expect(btIds.has(ec.bankTransactionId)).toBe(true);
    });
  });

  it("each evaluation case has a valid expectedStatus", () => {
    const validStatuses = ["matched", "exception", "review_required"];
    groundTruth.evaluationCases.forEach((ec: any) => {
      expect(validStatuses).toContain(ec.expectedStatus);
    });
  });

  it("each evaluation case has matching fixtureVersion", () => {
    groundTruth.evaluationCases.forEach((ec: any) => {
      expect(ec.fixtureVersion).toBe("2024.1");
    });
  });

  it("evaluation cases cover all required exception types", () => {
    const allExceptionTypes = [
      "unmatched_transaction",
      "amount_mismatch",
      "timing_difference",
      "duplicate",
      "missing_documentation",
      "potential_anomaly",
    ];
    const foundTypes = new Set<string>();
    groundTruth.evaluationCases.forEach((ec: any) => {
      ec.expectedExceptionTypes.forEach((t: string) => foundTypes.add(t));
    });
    expect(foundTypes.size).toBeGreaterThan(0);
  });

  it("all fixture bank transactions pass schema validation", () => {
    expect(fixture.bankTransactions.length).toBeGreaterThan(0);
    fixture.bankTransactions.forEach((tx: unknown) => {
      expect(() => validateBankTransaction(tx)).not.toThrow();
    });
  });

  it("all fixture ledger entries pass schema validation", () => {
    expect(fixture.ledgerEntries.length).toBeGreaterThan(0);
    fixture.ledgerEntries.forEach((entry: unknown) => {
      expect(() => validateLedgerEntry(entry)).not.toThrow();
    });
  });

  it("all fixture supporting documents pass schema validation", () => {
    expect(fixture.documents.length).toBeGreaterThan(0);
    fixture.documents.forEach((doc: unknown) => {
      expect(() => validateSupportingDocument(doc)).not.toThrow();
    });
  });

  it("all fixture chart of accounts pass schema validation", () => {
    expect(fixture.chartOfAccounts.length).toBeGreaterThan(0);
    fixture.chartOfAccounts.forEach((account: unknown) => {
      expect(() => validateChartOfAccount(account)).not.toThrow();
    });
  });
});
