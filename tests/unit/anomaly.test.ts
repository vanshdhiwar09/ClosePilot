// tests/unit/anomaly.test.ts
// Unit tests for deterministic account-level anomaly detection.

import { describe, it, expect } from "vitest";
import { computeAccountBaselines, checkTransactionAnomaly } from "../../src/reconciliation/anomaly";
import { BankTransaction } from "../../src/schemas/bank-transaction";

describe("Deterministic Account Outlier & Anomaly Detection", () => {
  const createTx = (id: string, amount: string, accountId = "Acct123"): BankTransaction => ({
    id,
    accountId,
    transactionDate: "2024-01-15",
    amount,
    currency: "USD",
    direction: "debit",
    description: "Test tx",
    source: "synthetic_bank",
    sourceRecordId: id,
    schemaVersion: "1",
    ingestedAt: "2024-01-30T09:00:00Z",
    rawHash: `hash-${id}`,
  });

  it("computes account median and threshold using 5x multiplier", () => {
    // Amounts: 300, 500, 1000, 1250, 2500 -> median is 1000.00
    // 5x median is 5000.00
    const txs = [
      createTx("T1", "300.00"),
      createTx("T2", "500.00"),
      createTx("T3", "1000.00"),
      createTx("T4", "1250.00"),
      createTx("T5", "2500.00"),
    ];

    const baselines = computeAccountBaselines(txs);
    const baseline = baselines.get("Acct123")!;

    expect(baseline).toBeDefined();
    expect(baseline.medianFormatted).toBe("1000.00");
    expect(baseline.thresholdFormatted).toBe("5000.00");
    expect(baseline.basis).toBe("dataset_median_multiplier");
  });

  it("flags transactions exceeding the account threshold as potential anomaly", () => {
    const txs = [
      createTx("T1", "300.00"),
      createTx("T2", "500.00"),
      createTx("T3", "1000.00"),
      createTx("T4", "1250.00"),
      createTx("T5", "2500.00"),
    ];
    const baselines = computeAccountBaselines(txs);

    const normalTx = createTx("TN", "1250.00");
    const normalCheck = checkTransactionAnomaly(normalTx, baselines);
    expect(normalCheck.isAnomaly).toBe(false);

    const largeTx = createTx("TL", "15000.00");
    const anomalyCheck = checkTransactionAnomaly(largeTx, baselines);
    expect(anomalyCheck.isAnomaly).toBe(true);
    expect(anomalyCheck.reason).toContain("exceeds account Acct123 threshold");
  });

  it("respects explicit account threshold overrides", () => {
    const txs = [createTx("T1", "1000.00")];
    const baselines = computeAccountBaselines(txs, {
      explicitThresholds: { Acct123: "20000.00" },
    });

    const baseline = baselines.get("Acct123")!;
    expect(baseline.thresholdFormatted).toBe("20000.00");
    expect(baseline.basis).toBe("explicit_config");

    // 15000.00 is below explicit threshold 20000.00
    const tx = createTx("T15", "15000.00");
    const check = checkTransactionAnomaly(tx, baselines);
    expect(check.isAnomaly).toBe(false);
  });
});
