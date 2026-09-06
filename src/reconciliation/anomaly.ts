// src/reconciliation/anomaly.ts
// Deterministic outlier and anomaly detection based on account-level transaction distributions.
// Uses BigInt cents arithmetic; no floating-point calculations or arbitrary magic numbers.

import { BankTransaction } from "../schemas/bank-transaction";
import { formatCents, parseCents } from "../utils/money";

export type AnomalyConfig = {
  // Configurable account-level threshold overrides (decimal string per account)
  explicitThresholds?: Record<string, string>;
  // Multiplier over the account's median transaction amount (default: 5)
  medianMultiplier?: bigint;
};

export type AccountBaseline = {
  accountId: string;
  sampleCount: number;
  medianCents: bigint;
  medianFormatted: string;
  thresholdCents: bigint;
  thresholdFormatted: string;
  basis: "explicit_config" | "dataset_median_multiplier";
};

export type AnomalyCheckResult = {
  isAnomaly: boolean;
  amount: string;
  amountCents: bigint;
  thresholdCents?: bigint;
  thresholdFormatted?: string;
  reason?: string;
};

const DEFAULT_MULTIPLIER = 5n;

/**
 * Computes deterministic account anomaly thresholds from available transaction data.
 * For each account:
 * - If an explicit threshold is configured in options, that threshold is used.
 * - Otherwise, computes the account median transaction amount (in BigInt cents)
 *   and sets the anomaly threshold to median * medianMultiplier (default: 5x median).
 */
export function computeAccountBaselines(
  transactions: BankTransaction[],
  config?: AnomalyConfig
): Map<string, AccountBaseline> {
  const multiplier = config?.medianMultiplier || DEFAULT_MULTIPLIER;
  const explicit = config?.explicitThresholds || {};

  const byAccount = new Map<string, bigint[]>();

  for (const tx of transactions) {
    const list = byAccount.get(tx.accountId) || [];
    list.push(parseCents(tx.amount));
    byAccount.set(tx.accountId, list);
  }

  const baselines = new Map<string, AccountBaseline>();

  for (const [accountId, amounts] of byAccount.entries()) {
    // If explicitly configured, use configured threshold
    if (explicit[accountId]) {
      const explicitCents = parseCents(explicit[accountId]);
      baselines.set(accountId, {
        accountId,
        sampleCount: amounts.length,
        medianCents: 0n,
        medianFormatted: "0.00",
        thresholdCents: explicitCents,
        thresholdFormatted: formatCents(explicitCents),
        basis: "explicit_config",
      });
      continue;
    }

    // Sort amounts in ascending order
    amounts.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    // Calculate median
    const mid = Math.floor(amounts.length / 2);
    const medianCents = amounts.length % 2 === 1
      ? amounts[mid]
      : (amounts[mid - 1] + amounts[mid]) / 2n;

    // Set threshold at median * multiplier
    const thresholdCents = medianCents * multiplier;

    baselines.set(accountId, {
      accountId,
      sampleCount: amounts.length,
      medianCents,
      medianFormatted: formatCents(medianCents),
      thresholdCents,
      thresholdFormatted: formatCents(thresholdCents),
      basis: "dataset_median_multiplier",
    });
  }

  return baselines;
}

/**
 * Checks whether a bank transaction amount exceeds the account's deterministic anomaly threshold.
 */
export function checkTransactionAnomaly(
  bankTx: BankTransaction,
  baselines: Map<string, AccountBaseline>
): AnomalyCheckResult {
  const amountCents = parseCents(bankTx.amount);
  const baseline = baselines.get(bankTx.accountId);

  if (!baseline) {
    return {
      isAnomaly: false,
      amount: bankTx.amount,
      amountCents,
    };
  }

  if (amountCents > baseline.thresholdCents) {
    const reason = baseline.basis === "explicit_config"
      ? `Transaction amount ${bankTx.amount} exceeds explicit account threshold ${baseline.thresholdFormatted}`
      : `Transaction amount ${bankTx.amount} exceeds account ${bankTx.accountId} threshold (${baseline.thresholdFormatted}, computed as 5x median ${baseline.medianFormatted})`;

    return {
      isAnomaly: true,
      amount: bankTx.amount,
      amountCents,
      thresholdCents: baseline.thresholdCents,
      thresholdFormatted: baseline.thresholdFormatted,
      reason,
    };
  }

  return {
    isAnomaly: false,
    amount: bankTx.amount,
    amountCents,
    thresholdCents: baseline.thresholdCents,
    thresholdFormatted: baseline.thresholdFormatted,
  };
}
