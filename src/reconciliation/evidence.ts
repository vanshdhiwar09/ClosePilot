// src/reconciliation/evidence.ts
// Deterministic evidence item creation and linkage.
// Evidence items link source records, calculations, rule traces, and supporting documents.

import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { SupportingDocument } from "../schemas/supporting-document";
import { EvidenceItem } from "../schemas/evidence-item";
import { RuleTraceStep } from "./types";

/**
 * Creates an EvidenceItem linking a source BankTransaction or LedgerEntry.
 */
export function createSourceRecordEvidence(
  subjectType: "result" | "exception",
  subjectId: string,
  recordType: "bank_transaction" | "ledger_entry",
  record: BankTransaction | LedgerEntry,
  createdAt: string = new Date().toISOString()
): EvidenceItem {
  return {
    id: `EV-SRC-${record.id}-${subjectId}`,
    kind: "source_record",
    subjectType,
    subjectId,
    sourceId: record.id,
    locator: `${recordType}:${record.id}`,
    contentHash: record.rawHash,
    payload: {
      recordType,
      recordId: record.id,
      accountId: record.accountId,
      amount: "amount" in record ? record.amount : `${record.debit}/${record.credit}`,
      currency: record.currency,
      date: "transactionDate" in record ? record.transactionDate : record.entryDate,
      reference: record.reference,
    },
    createdAt,
  };
}

/**
 * Creates an EvidenceItem capturing a matching rule evaluation step.
 */
export function createMatchRuleEvidence(
  subjectType: "result" | "exception",
  subjectId: string,
  step: RuleTraceStep,
  createdAt: string = new Date().toISOString()
): EvidenceItem {
  return {
    id: `EV-RULE-${step.rule}-${subjectId}`,
    kind: "match_rule",
    subjectType,
    subjectId,
    locator: `rule:${step.rule}`,
    payload: {
      rule: step.rule,
      description: step.description,
      passed: step.passed,
      details: step.details,
    },
    createdAt,
  };
}

/**
 * Creates an EvidenceItem capturing a deterministic monetary or date calculation.
 */
export function createCalculationEvidence(
  subjectType: "result" | "exception",
  subjectId: string,
  calculationType: "amount_difference" | "date_difference" | "anomaly_threshold",
  payload: Record<string, unknown>,
  createdAt: string = new Date().toISOString()
): EvidenceItem {
  return {
    id: `EV-CALC-${calculationType}-${subjectId}`,
    kind: "calculation",
    subjectType,
    subjectId,
    locator: `calc:${calculationType}`,
    payload: {
      calculationType,
      ...payload,
    },
    createdAt,
  };
}

/**
 * Creates an EvidenceItem linking a found supporting document.
 */
export function createDocumentEvidence(
  subjectType: "result" | "exception",
  subjectId: string,
  doc: SupportingDocument,
  createdAt: string = new Date().toISOString()
): EvidenceItem {
  return {
    id: `EV-DOC-${doc.id}-${subjectId}`,
    kind: "document",
    subjectType,
    subjectId,
    sourceId: doc.id,
    locator: `document:${doc.id}`,
    contentHash: doc.sha256,
    payload: {
      documentId: doc.id,
      fileName: doc.fileName,
      uri: doc.uri,
      documentType: doc.documentType,
      vendor: doc.vendor,
      amount: doc.amount,
      references: doc.references,
    },
    createdAt,
  };
}

/**
 * Creates an EvidenceItem recording a missing documentation finding.
 */
export function createMissingDocumentEvidence(
  subjectType: "result" | "exception",
  subjectId: string,
  ledgerEntryId: string,
  reason: string,
  createdAt: string = new Date().toISOString()
): EvidenceItem {
  return {
    id: `EV-MISSDOC-${ledgerEntryId}-${subjectId}`,
    kind: "document",
    subjectType,
    subjectId,
    locator: `ledger_entry:${ledgerEntryId}`,
    payload: {
      finding: "missing_documentation",
      ledgerEntryId,
      reason,
    },
    createdAt,
  };
}
