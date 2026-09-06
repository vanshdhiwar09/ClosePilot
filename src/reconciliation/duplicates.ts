// src/reconciliation/duplicates.ts
// Deterministic duplicate detection for financial records.
// Groups records sharing account, monetary amount (BigInt cents), and reference within date tolerance.

import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry, getLedgerSignedAmount } from "../schemas/ledger-entry";
import { isEqualMoney, parseCents } from "../utils/money";
import { calculateDateDifferenceDays } from "./date";
import { normalizeReference } from "./normalize";

export type DuplicateGroup<T = BankTransaction | LedgerEntry> = {
  groupId: string;
  recordType: "bank" | "ledger";
  accountId: string;
  amount: string; // decimal string
  reference: string;
  recordIds: string[];
  records: T[];
  dateRangeDays: number;
};

export type DuplicateDetectionOptions = {
  dateToleranceDays?: number; // default: 2 days
  configVersion?: string;
};

const DEFAULT_OPTIONS: Required<DuplicateDetectionOptions> = {
  dateToleranceDays: 2,
  configVersion: "2024.1",
};

/**
 * Detects duplicate clusters in bank transactions.
 */
export function detectBankDuplicates(
  transactions: BankTransaction[],
  options?: DuplicateDetectionOptions
): DuplicateGroup<BankTransaction>[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const groups: DuplicateGroup<BankTransaction>[] = [];

  // Group by (accountId, normalizedReference)
  const buckets = new Map<string, BankTransaction[]>();

  for (const tx of transactions) {
    const normRef = normalizeReference(tx.reference);
    if (!normRef) continue;
    const key = `${tx.accountId}::${normRef}`;
    const list = buckets.get(key) || [];
    list.push(tx);
    buckets.set(key, list);
  }

  let groupCounter = 1;

  for (const [, bucket] of buckets.entries()) {
    if (bucket.length < 2) continue;

    // Compare each pair in bucket for identical amount and date tolerance
    const visited = new Set<string>();

    for (let i = 0; i < bucket.length; i++) {
      const current = bucket[i];
      if (visited.has(current.id)) continue;

      const cluster: BankTransaction[] = [current];

      for (let j = i + 1; j < bucket.length; j++) {
        const candidate = bucket[j];
        if (visited.has(candidate.id)) continue;

        if (
          isEqualMoney(current.amount, candidate.amount) &&
          calculateDateDifferenceDays(current.transactionDate, candidate.transactionDate) <= opts.dateToleranceDays
        ) {
          cluster.push(candidate);
        }
      }

      if (cluster.length >= 2) {
        cluster.forEach((rec) => visited.add(rec.id));
        const dates = cluster.map((r) => r.transactionDate).sort();
        const dateRangeDays = calculateDateDifferenceDays(dates[0], dates[dates.length - 1]);

        groups.push({
          groupId: `DUP-BANK-${groupCounter++}`,
          recordType: "bank",
          accountId: current.accountId,
          amount: current.amount,
          reference: normalizeReference(current.reference)!,
          recordIds: cluster.map((r) => r.id),
          records: cluster,
          dateRangeDays,
        });
      }
    }
  }

  return groups;
}

/**
 * Detects duplicate clusters in ledger entries.
 */
export function detectLedgerDuplicates(
  entries: LedgerEntry[],
  options?: DuplicateDetectionOptions
): DuplicateGroup<LedgerEntry>[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const groups: DuplicateGroup<LedgerEntry>[] = [];

  // Group by (accountId, normalizedReference)
  const buckets = new Map<string, LedgerEntry[]>();

  for (const entry of entries) {
    const normRef = normalizeReference(entry.reference);
    if (!normRef) continue;
    const key = `${entry.accountId}::${normRef}`;
    const list = buckets.get(key) || [];
    list.push(entry);
    buckets.set(key, list);
  }

  let groupCounter = 1;

  for (const [, bucket] of buckets.entries()) {
    if (bucket.length < 2) continue;

    const visited = new Set<string>();

    for (let i = 0; i < bucket.length; i++) {
      const current = bucket[i];
      if (visited.has(current.id)) continue;

      const currentAmount = getLedgerSignedAmount(current);
      const cluster: LedgerEntry[] = [current];

      for (let j = i + 1; j < bucket.length; j++) {
        const candidate = bucket[j];
        if (visited.has(candidate.id)) continue;

        const candidateAmount = getLedgerSignedAmount(candidate);

        if (
          isEqualMoney(currentAmount, candidateAmount) &&
          calculateDateDifferenceDays(current.entryDate, candidate.entryDate) <= opts.dateToleranceDays
        ) {
          cluster.push(candidate);
        }
      }

      if (cluster.length >= 2) {
        const dates = cluster.map((r) => r.entryDate).sort();
        const dateRangeDays = calculateDateDifferenceDays(dates[0], dates[dates.length - 1]);

        // Duplicates recur across near-identical dates (dateRangeDays > 0).
        // Identical-date entries (dateRangeDays === 0) are treated as ambiguous postings for human review.
        if (dateRangeDays > 0) {
          cluster.forEach((rec) => visited.add(rec.id));
          groups.push({
            groupId: `DUP-LEDGER-${groupCounter++}`,
            recordType: "ledger",
            accountId: current.accountId,
            amount: currentAmount,
            reference: normalizeReference(current.reference)!,
            recordIds: cluster.map((r) => r.id),
            records: cluster,
            dateRangeDays,
          });
        }
      }
    }
  }

  return groups;
}
