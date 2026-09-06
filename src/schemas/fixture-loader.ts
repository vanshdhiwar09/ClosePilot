// src/schemas/fixture-loader.ts
// Deterministic fixture data loader
// Loads a named synthetic fixture and returns validated records

import { BankTransaction, bankTransactionSchema } from "./bank-transaction";
import { LedgerEntry, ledgerEntrySchema } from "./ledger-entry";
import { SupportingDocument, supportingDocumentSchema } from "./supporting-document";
import { ChartOfAccount, chartOfAccountSchema } from "./chart-of-account";
import {
  ReconciliationResult,
  reconciliationResultSchema,
} from "./reconciliation-result";
import {
  Exception,
  exceptionSchema,
} from "./exception";
import { EvidenceItem, evidenceItemSchema } from "./evidence-item";
import { EvaluationCase, evaluationCaseSchema } from "./evaluation-case";
import * as fs from "node:fs";
import * as path from "node:path";

// Resolve data directories relative to project root (CWD)
// The hackathon runs from the project root, so process.cwd() gives the project root
const PROJECT_ROOT = process.cwd();
const FIXTURES_DIR = path.resolve(PROJECT_ROOT, "data/fixtures");
const GROUND_TRUTH_DIR = path.resolve(PROJECT_ROOT, "data/ground-truth");

// Export types
export type { FixtureMetadata } from "./input-ref";

// Type for fixture record sets
type FixtureRecords = {
  bankTransactions?: BankTransaction[];
  ledgerEntries?: LedgerEntry[];
  documents?: SupportingDocument[];
  chartOfAccounts?: ChartOfAccount[];
};

// Load a fixture by name (without .json extension)
export const loadFixture = (fixtureName: string): Record<string, unknown> => {
  const fixturePath = path.join(FIXTURES_DIR, `${fixtureName}.json`);
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${fixturePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
  return raw as Record<string, unknown>;
};

// Load ground truth by fixture version
export const loadGroundTruth = (fixtureVersion: string): Record<string, unknown> => {
  const gtPath = path.join(GROUND_TRUTH_DIR, `${fixtureVersion}.json`);
  if (!fs.existsSync(gtPath)) {
    throw new Error(`Ground truth not found: ${gtPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(gtPath, "utf-8"));
  return raw as Record<string, unknown>;
};

// Validate a BankTransaction record
export const validateBankTransaction = (raw: unknown): BankTransaction => {
  try {
    return bankTransactionSchema.parse(raw);
  } catch (error: any) {
    throw new Error(
      `Invalid BankTransaction: ${error.errors.map((e: any) => e.message).join(", ")}`
    );
  }
};

// Validate a LedgerEntry record
export const validateLedgerEntry = (raw: unknown): LedgerEntry => {
  try {
    return ledgerEntrySchema.parse(raw);
  } catch (error: any) {
    throw new Error(
      `Invalid LedgerEntry: ${error.errors.map((e: any) => e.message).join(", ")}`
    );
  }
};

// Validate a SupportingDocument record
export const validateSupportingDocument = (raw: unknown): SupportingDocument => {
  try {
    return supportingDocumentSchema.parse(raw);
  } catch (error: any) {
    throw new Error(
      `Invalid SupportingDocument: ${error.errors.map((e: any) => e.message).join(", ")}`
    );
  }
};

// Validate a ChartOfAccount record
export const validateChartOfAccount = (raw: unknown): ChartOfAccount => {
  try {
    return chartOfAccountSchema.parse(raw);
  } catch (error: any) {
    throw new Error(
      `Invalid ChartOfAccount: ${error.errors.map((e: any) => e.message).join(", ")}`
    );
  }
};

// Validate a ReconciliationResult record
export const validateReconciliationResult = (raw: unknown): ReconciliationResult => {
  try {
    return reconciliationResultSchema.parse(raw);
  } catch (error: any) {
    throw new Error(
      `Invalid ReconciliationResult: ${error.errors.map((e: any) => e.message).join(", ")}`
    );
  }
};

// Validate an Exception record
export const validateException = (raw: unknown): Exception => {
  try {
    return exceptionSchema.parse(raw);
  } catch (error: any) {
    throw new Error(
      `Invalid Exception: ${error.errors.map((e: any) => e.message).join(", ")}`
    );
  }
};

// Validate an EvidenceItem record
export const validateEvidenceItem = (raw: unknown): EvidenceItem => {
  try {
    return evidenceItemSchema.parse(raw);
  } catch (error: any) {
    throw new Error(
      `Invalid EvidenceItem: ${error.errors.map((e: any) => e.message).join(", ")}`
    );
  }
};

// Validate an EvaluationCase record
export const validateEvaluationCase = (raw: unknown): EvaluationCase => {
  try {
    return evaluationCaseSchema.parse(raw);
  } catch (error: any) {
    throw new Error(
      `Invalid EvaluationCase: ${error.errors.map((e: any) => e.message).join(", ")}`
    );
  }
};

// Get fixture metadata
export const getFixtureMetadata = (fixtureName: string) => {
  const raw = loadFixture(fixtureName);
  // Type-safe accessor for fixture records
  const getArrayLength = (raw: Record<string, unknown>, key: string): number => {
    const value = raw[key as keyof Record<string, unknown>];
    if (Array.isArray(value)) {
      return value.length;
    }
    return 0;
  };
  return {
    fixtureVersion: (raw as any).fixtureVersion || "unknown",
    description: (raw as any).description || "Synthetic fixture",
    createdAt: (raw as any).createdAt || new Date().toISOString(),
    recordCount: {
      bankTransactions: getArrayLength(raw as any, "bankTransactions"),
      ledgerEntries: getArrayLength(raw as any, "ledgerEntries"),
      documents: getArrayLength(raw as any, "documents"),
      chartOfAccounts: getArrayLength(raw as any, "chartOfAccounts"),
    },
  };
};