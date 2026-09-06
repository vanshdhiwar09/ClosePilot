// src/evaluation/runner.ts
// End-to-end evaluation runner executing reconciliation against versioned ground truth.
// Computes all mandatory metrics and produces structured failure diagnostics.

import { loadFixture, loadGroundTruth } from "../schemas/fixture-loader";
import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { SupportingDocument } from "../schemas/supporting-document";
import { EvaluationCase } from "../schemas/evaluation-case";
import {
  initializePipelineContext,
  reconcileBankTransaction,
} from "../reconciliation/pipeline";
import { MatcherConfig } from "../reconciliation/types";
import { CaseEvaluationResult, EvaluationRunReport } from "./types";
import { calculateEvaluationMetrics } from "./metrics";
import { diagnoseCaseFailure } from "./failure";

export type EvaluationOptions = {
  fixtureName?: string;
  groundTruthVersion?: string;
  fixtureData?: Record<string, unknown>;
  groundTruthData?: Record<string, unknown>;
  workflowVersion?: string;
  matcherConfig?: MatcherConfig;
};

/**
 * Runs evaluation deterministically on a fixture against ground truth.
 */
export function runEvaluation(options?: EvaluationOptions): EvaluationRunReport {
  const fixtureName = options?.fixtureName || "month-end-reconciliation-2024.1";
  const groundTruthVersion = options?.groundTruthVersion || "2024.1";
  const workflowVersion = options?.workflowVersion || "2024.1";

  const fixture = (options?.fixtureData || loadFixture(fixtureName)) as any;
  const groundTruth = (options?.groundTruthData || loadGroundTruth(groundTruthVersion)) as any;

  const bankTransactions: BankTransaction[] = fixture.bankTransactions;
  const ledgerEntries: LedgerEntry[] = fixture.ledgerEntries;
  const documents: SupportingDocument[] = fixture.documents;
  const evaluationCases: EvaluationCase[] = groundTruth.evaluationCases;

  const context = initializePipelineContext(bankTransactions, ledgerEntries, {
    workflowVersion,
    matcherConfig: options?.matcherConfig,
  });

  const runStart = performance.now();
  const caseResults: CaseEvaluationResult[] = [];

  for (const ec of evaluationCases) {
    const bankTx = bankTransactions.find((b) => b.id === ec.bankTransactionId);
    if (!bankTx) {
      throw new Error(
        `Evaluation failed: BankTransaction ${ec.bankTransactionId} not found in fixture ${fixtureName}`
      );
    }

    const caseStart = performance.now();
    const output = reconcileBankTransaction(bankTx, ledgerEntries, documents, context);
    const durationMs = performance.now() - caseStart;

    const actualStatus = output.result.status;
    const expectedStatus = ec.expectedStatus;
    const statusMatch = actualStatus === expectedStatus;

    const actualAuto = output.autoResolutionAllowed;
    const expectedAuto = ec.expectedAutoResolutionAllowed;
    const autoResolutionMatch = actualAuto === expectedAuto;

    const actualMatched = (
      output.result.matchedLedgerEntryIds.length > 0
        ? output.result.matchedLedgerEntryIds
        : output.result.candidateLedgerEntryIds
    ).slice().sort();
    const expectedMatched = ec.expectedLedgerEntryIds.slice().sort();
    const candidateMatch =
      actualMatched.length === expectedMatched.length &&
      actualMatched.every((id, idx) => id === expectedMatched[idx]);

    const actualExceptions = output.exceptions.map((e) => e.type).sort();
    const expectedExceptions = (ec.expectedExceptionTypes || []).slice().sort();
    const exceptionMatch =
      actualExceptions.length === expectedExceptions.length &&
      actualExceptions.every((t, idx) => t === expectedExceptions[idx]);

    const isAgreement = statusMatch && candidateMatch && exceptionMatch && autoResolutionMatch;

    const failure = isAgreement
      ? undefined
      : diagnoseCaseFailure(ec, output, {
          statusMatch,
          candidateMatch,
          exceptionMatch,
          autoResolutionMatch,
        });

    caseResults.push({
      caseId: ec.id,
      bankTransactionId: ec.bankTransactionId,
      isAgreement,
      statusMatch,
      candidateMatch,
      exceptionMatch,
      autoResolutionMatch,
      expectedStatus,
      actualStatus,
      expectedAutoResolutionAllowed: expectedAuto,
      actualAutoResolutionAllowed: actualAuto,
      expectedLedgerEntryIds: ec.expectedLedgerEntryIds,
      actualMatchedLedgerEntryIds: output.result.matchedLedgerEntryIds,
      expectedExceptions: ec.expectedExceptionTypes || [],
      actualExceptions: output.exceptions.map((e) => e.type),
      durationMs,
      failure,
    });
  }

  const totalDurationMs = performance.now() - runStart;
  const metrics = calculateEvaluationMetrics(caseResults, evaluationCases, totalDurationMs);
  const failures = caseResults
    .map((r) => r.failure)
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  return {
    runId: `EVAL-${groundTruthVersion}-${Date.now()}`,
    fixtureVersion: groundTruthVersion,
    workflowVersion,
    timestamp: new Date().toISOString(),
    metrics,
    caseResults,
    failures,
  };
}

/**
 * Formats an evaluation run report into a clean, markdown-compatible summary.
 */
export function formatEvaluationReport(report: EvaluationRunReport): string {
  const m = report.metrics;
  const pct = (val: number) => `${(val * 100).toFixed(1)}%`;

  let out = `## ClosePilot Evaluation Report — Fixture ${report.fixtureVersion}\n\n`;
  out += `Run ID: ${report.runId} | Timestamp: ${report.timestamp}\n\n`;
  out += `### Key Metrics Summary\n\n`;
  out += `| Metric | Value | Raw Counts / Detail |\n`;
  out += `|---|---|---|\n`;
  out += `| **Auto-Reconciliation Rate** | **${pct(m.autoReconciliationRate)}** | ${m.counts.eligibleAutoResolvedCount} / ${m.counts.eligibleCasesCount} eligible cases |\n`;
  out += `| **Match Precision** | **${pct(m.matchPrecision)}** | ${m.counts.correctAutoResolutionsCount} / ${m.counts.allAutoResolutionsCount} auto-closed cases |\n`;
  out += `| **Exception Recall** | **${pct(m.exceptionRecall)}** | ${m.counts.detectedExceptionsCount} / ${m.counts.groundTruthExceptionsCount} ground-truth exceptions |\n`;
  out += `| **False Auto-Close Rate** | **${pct(m.falseAutoCloseRate)}** | ${m.counts.incorrectAutoResolutionsCount} / ${m.counts.allAutoResolutionsCount} auto-closed cases |\n`;
  out += `| **Human Review Load** | **${pct(m.humanReviewLoad)}** | ${m.counts.humanReviewCount} / ${m.totalCases} processed cases |\n`;
  out += `| **Overall Agreement Accuracy** | **${pct(m.accuracy)}** | ${m.totalAgreements} / ${m.totalCases} cases agreeing with ground truth |\n`;
  out += `| **Total Processing Time** | **${m.processingTime.totalDurationMs.toFixed(2)}ms** | Average: ${m.processingTime.averageDurationPerCaseMs.toFixed(2)}ms/case |\n\n`;

  out += `### Per-Case Evaluation Breakdown\n\n`;
  out += `| Case ID | Bank Tx | Status (Exp / Act) | Auto-Close (Exp / Act) | Exceptions (Exp / Act) | Agreement |\n`;
  out += `|---|---|---|---|---|---|\n`;

  for (const c of report.caseResults) {
    const statusStr = `${c.expectedStatus} / ${c.actualStatus}`;
    const autoStr = `${c.expectedAutoResolutionAllowed} / ${c.actualAutoResolutionAllowed}`;
    const expExStr = c.expectedExceptions.length > 0 ? c.expectedExceptions.join(",") : "none";
    const actExStr = c.actualExceptions.length > 0 ? c.actualExceptions.join(",") : "none";
    const exStr = `${expExStr} / ${actExStr}`;
    const agreeStr = c.isAgreement ? "✅ AGREE" : "❌ DISAGREE";
    out += `| ${c.caseId} | ${c.bankTransactionId} | ${statusStr} | ${autoStr} | ${exStr} | ${agreeStr} |\n`;
  }

  if (report.failures.length > 0) {
    out += `\n### Failure Diagnostics (${report.failures.length} discrepancies)\n\n`;
    for (const f of report.failures) {
      out += `#### Disagreement: Case ${f.caseId} (${f.bankTransactionId})\n`;
      out += `- **Type**: ${f.disagreementType}\n`;
      out += `- **Recommended Category**: \`${f.recommendedCategory}\`\n`;
      out += `- **Explanation**: ${f.explanation}\n`;
      out += `- **Expected**: ${JSON.stringify(f.expectedOutcome)}\n`;
      out += `- **Predicted**: ${JSON.stringify(f.predictedOutcome)}\n\n`;
    }
  } else {
    out += `\n> **Zero Disagreements**: All predicted behaviors match immutable ground truth labels with 100% fidelity.\n`;
  }

  return out;
}
