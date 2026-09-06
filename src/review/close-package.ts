// src/review/close-package.ts
// Generates an evidence-backed ClosePackage from reconciliation and human-review states.
// Answers "Why was this case considered closed?" while preserving full audit traceability.

import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { SupportingDocument } from "../schemas/supporting-document";
import { EvaluationCase } from "../schemas/evaluation-case";
import { loadFixture, loadGroundTruth } from "../schemas/fixture-loader";
import {
  initializePipelineContext,
  reconcileBankTransaction,
} from "../reconciliation/pipeline";
import { formatCents, parseCents } from "../utils/money";
import { HumanReviewSession } from "./state-machine";
import {
  CaseCloseRecord,
  CaseReviewInput,
  ClosePackage,
  ClosePackageSummary,
  HumanReviewState,
} from "./types";

export type ClosePackageOptions = {
  packageId?: string;
  period?: string;
  workflowVersion?: string;
  environment?: string;
};

/**
 * Generates an evidence-backed ClosePackage from an active HumanReviewSession.
 * All metrics, status breakdowns, and closure reasons are derived deterministically.
 */
export function generateClosePackage(
  session: HumanReviewSession,
  options?: ClosePackageOptions
): ClosePackage {
  const cases = session.listCases();
  const period = options?.period || "2024.1";
  const workflowVersion = options?.workflowVersion || "2024.1";
  const packageId =
    options?.packageId || `CLOSE-${period}-${Date.now()}`;

  let automaticallyResolvedCount = 0;
  let humanReviewedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let unresolvedCount = 0;

  let totalReconciledCents = 0n;
  let totalUnreconciledCents = 0n;

  const exceptionCounts: Record<string, number> = {};
  const caseRecords: CaseCloseRecord[] = [];

  for (const ctx of cases) {
    const statusInfo = session.getCaseCloseStatus(ctx.caseId);
    const bankTxAmount = parseCents(ctx.bankTransaction.amount);

    if (ctx.isAutoResolved) {
      automaticallyResolvedCount += 1;
    }

    if (ctx.decisionHistory.length > 0) {
      humanReviewedCount += 1;
    }

    if (statusInfo.finalStatus === "closed") {
      totalReconciledCents += bankTxAmount;
      if (!ctx.isAutoResolved) {
        approvedCount += 1;
      }
    } else if (statusInfo.finalStatus === "rejected") {
      rejectedCount += 1;
      totalUnreconciledCents += bankTxAmount;
    } else {
      unresolvedCount += 1;
      totalUnreconciledCents += bankTxAmount;
    }

    // Accumulate exceptions
    for (const ex of ctx.reconciliationOutput.exceptions) {
      exceptionCounts[ex.type] = (exceptionCounts[ex.type] || 0) + 1;
    }

    // Rule trace from matchResult
    const ruleTrace = ctx.reconciliationOutput.matchResult?.ruleTrace || [];

    const record: CaseCloseRecord = {
      caseId: ctx.caseId,
      bankTransactionId: ctx.bankTransaction.id,
      finalStatus: statusInfo.finalStatus,
      isClosed: statusInfo.isClosed,
      closureReason: statusInfo.closureReason,
      sourceTransaction: ctx.bankTransaction,
      reconciliationResult: ctx.reconciliationOutput.result,
      candidateLedgerEntries: ctx.candidateLedgerEntries,
      ruleTrace,
      exceptions: ctx.reconciliationOutput.exceptions,
      evidence: ctx.evidence,
      humanReviewState: ctx.isAutoResolved
        ? undefined
        : (ctx.currentState as HumanReviewState),
      decisionHistory: [...ctx.decisionHistory],
      outstandingRequirements: statusInfo.outstandingRequirements,
      investigation: ctx.investigation,
    };

    caseRecords.push(record);
  }

  const totalCases = cases.length;
  const allCasesClosed = unresolvedCount === 0 && rejectedCount === 0;

  const summary: ClosePackageSummary = {
    totalCases,
    automaticallyResolvedCases: automaticallyResolvedCount,
    humanReviewedCases: humanReviewedCount,
    approvedCases: approvedCount,
    rejectedCases: rejectedCount,
    unresolvedCases: unresolvedCount,
    allCasesClosed,
    totalReconciledAmount: formatCents(totalReconciledCents),
    totalUnreconciledAmount: formatCents(totalUnreconciledCents),
    exceptionCounts,
  };

  return {
    packageId,
    period,
    workflowVersion,
    generatedAt: new Date().toISOString(),
    summary,
    cases: caseRecords,
    metadata: {
      engineVersion: "0.1.0",
      environment: options?.environment || "local_synthetic",
    },
  };
}

/**
 * Convenience helper to run reconciliation on a fixture and initialize a HumanReviewSession.
 */
export function createFixtureReviewSession(
  fixtureName: string = "month-end-reconciliation-2024.1",
  groundTruthVersion: string = "2024.1"
): HumanReviewSession {
  const fixture = loadFixture(fixtureName) as any;
  const groundTruth = loadGroundTruth(groundTruthVersion) as any;

  const bankTransactions: BankTransaction[] = fixture.bankTransactions;
  const ledgerEntries: LedgerEntry[] = fixture.ledgerEntries;
  const documents: SupportingDocument[] = fixture.documents;
  const evaluationCases: EvaluationCase[] = groundTruth.evaluationCases;

  const context = initializePipelineContext(bankTransactions, ledgerEntries);

  const inputs: CaseReviewInput[] = [];

  for (const ec of evaluationCases) {
    const bankTx = bankTransactions.find((b) => b.id === ec.bankTransactionId);
    if (!bankTx) {
      throw new Error(`BankTransaction "${ec.bankTransactionId}" not found in fixture.`);
    }

    const output = reconcileBankTransaction(bankTx, ledgerEntries, documents, context);
    const candidateIds = output.result.candidateLedgerEntryIds;
    const candidates = ledgerEntries.filter((e) => candidateIds.includes(e.id));

    inputs.push({
      caseId: ec.id,
      bankTransaction: bankTx,
      reconciliationOutput: output,
      candidateLedgerEntries: candidates,
    });
  }

  return new HumanReviewSession(inputs);
}

/**
 * Generates an initial baseline ClosePackage directly from a fixture without human intervention.
 * Demonstrates accurate representation of unresolved review cases.
 */
export function generateFixtureClosePackage(
  fixtureName?: string,
  groundTruthVersion?: string,
  options?: ClosePackageOptions
): ClosePackage {
  const session = createFixtureReviewSession(fixtureName, groundTruthVersion);
  return generateClosePackage(session, options);
}

/**
 * Formats a ClosePackage into an audit-ready Markdown document.
 */
export function formatClosePackageMarkdown(pkg: ClosePackage): string {
  const s = pkg.summary;
  let out = `# ClosePilot Month-End Close Package — Period ${pkg.period}\n\n`;
  out += `**Package ID**: \`${pkg.packageId}\`  \n`;
  out += `**Generated At**: ${pkg.generatedAt}  \n`;
  out += `**Close Status**: ${s.allCasesClosed ? "✅ **FULLY CLOSED**" : "⚠️ **OPEN / UNRESOLVED ITEMS EXIST**"}\n\n`;

  out += `## 1. Executive Close Summary\n\n`;
  out += `| Metric | Count / Value |\n`;
  out += `|---|---|\n`;
  out += `| **Total Reconciliation Cases** | ${s.totalCases} |\n`;
  out += `| **Automatically Reconciled** | ${s.automaticallyResolvedCases} |\n`;
  out += `| **Human-Reviewed Cases** | ${s.humanReviewedCases} |\n`;
  out += `| **Approved by Reviewer** | ${s.approvedCases} |\n`;
  out += `| **Rejected by Reviewer** | ${s.rejectedCases} |\n`;
  out += `| **Outstanding / Unresolved Cases** | ${s.unresolvedCases} |\n`;
  out += `| **Total Reconciled Amount** | $${s.totalReconciledAmount} |\n`;
  out += `| **Total Unreconciled Amount** | $${s.totalUnreconciledAmount} |\n\n`;

  out += `## 2. Exception Breakdown\n\n`;
  const exEntries = Object.entries(s.exceptionCounts);
  if (exEntries.length > 0) {
    out += `| Exception Type | Count |\n`;
    out += `|---|---|\n`;
    for (const [type, count] of exEntries) {
      out += `| \`${type}\` | ${count} |\n`;
    }
    out += `\n`;
  } else {
    out += `*Zero exceptions detected across all cases.*\n\n`;
  }

  out += `## 3. Case-by-Case Close Ledger & Traceability\n\n`;
  out += `| Case ID | Bank Tx | Amount | Final Status | Closure Reason |\n`;
  out += `|---|---|---|---|---|\n`;

  for (const c of pkg.cases) {
    const statusIcon = c.isClosed ? "✅ CLOSED" : c.finalStatus === "rejected" ? "❌ REJECTED" : "⏳ UNRESOLVED";
    out += `| **${c.caseId}** | ${c.bankTransactionId} | $${c.sourceTransaction.amount} | ${statusIcon} | ${c.closureReason} |\n`;
  }

  out += `\n## 4. Detailed Audit & Traceability Records\n\n`;
  for (const c of pkg.cases) {
    out += `### Case ${c.caseId} (${c.bankTransactionId})\n`;
    out += `- **Status**: \`${c.finalStatus.toUpperCase()}\` (Closed: ${c.isClosed ? "YES" : "NO"})\n`;
    out += `- **Closure Reason**: ${c.closureReason}\n`;
    out += `- **Source Transaction**: ${c.sourceTransaction.description} | Date: ${c.sourceTransaction.transactionDate} | Amount: $${c.sourceTransaction.amount}\n`;
    out += `- **Reconciliation Status**: \`${c.reconciliationResult.status}\` | Match Method: \`${c.reconciliationResult.matchMethod}\` | Confidence: \`${c.reconciliationResult.confidence}\`\n`;

    if (c.candidateLedgerEntries.length > 0) {
      out += `- **Candidate Ledger Entries**: ${c.candidateLedgerEntries.map((e) => `${e.id} ($${e.debit !== "0.00" ? e.debit : e.credit})`).join(", ")}\n`;
    } else {
      out += `- **Candidate Ledger Entries**: None\n`;
    }

    if (c.exceptions.length > 0) {
      out += `- **Exceptions**: ${c.exceptions.map((e) => `\`${e.type}\``).join(", ")}\n`;
    }

    out += `- **Evidence References (${c.evidence.length})**: ${c.evidence.map((e) => `\`${e.id}\``).join(", ")}\n`;

    if (c.ruleTrace.length > 0) {
      out += `- **Rule Trace**:\n`;
      for (const r of c.ruleTrace) {
        out += `  - [${r.passed ? "PASS" : "FAIL"}] **${r.rule}**: ${r.description}\n`;
      }
    }

    if (c.investigation) {
      const inv = c.investigation;
      const duration =
        typeof inv.metadata?.durationMs === "number"
          ? inv.metadata.durationMs
          : inv.toolCalls.reduce((s, t) => s + t.durationMs, 0);
      out += `- **Autonomous Agent Investigation**:\n`;
      out += `  - **Investigation ID**: \`${inv.investigationId}\` (${inv.outcome}, ${duration.toFixed(1)}ms)\n`;
      out += `  - **Root Cause**: ${inv.rootCause}\n`;
      out += `  - **Advisory Recommendation**: \`${inv.recommendation.action}\` (Confidence: \`${inv.confidence}\`, Risk: \`${inv.riskLevel}\`)\n`;
      out += `  - **Recommendation Reason**: ${inv.recommendation.suggestedReason}\n`;
      out += `  - **Policy Validation**: ${inv.policyValidation.isPermitted ? "✅ PERMITTED" : "⚠️ VIOLATION / FORCED HUMAN REVIEW"} — Rule: \`${inv.policyValidation.policyRule}\` (${inv.policyValidation.policyReason})\n`;
      if (inv.rawModelRecommendation && inv.rawModelRecommendation.action !== inv.recommendation.action) {
        out += `  - **Raw Model Action (Pre-Policy Override)**: \`${inv.rawModelRecommendation.action}\`\n`;
      }
      out += `  - **Evidence Cited by Agent**: [${inv.evidenceIds.join(", ")}]\n`;
      out += `  - **Tool Calls Executed (${inv.toolCalls.length})**: ${inv.toolCalls.map((t) => `\`${t.toolName}\``).join(", ")}\n`;
    }

    if (c.decisionHistory.length > 0) {
      out += `- **Human Review Decision History (${c.decisionHistory.length})**:\n`;
      for (const d of c.decisionHistory) {
        out += `  - **${d.action}** by \`${d.reviewer.id}\` at ${d.timestamp}: "${d.reason}" (Evidence: [${d.evidenceIds.join(", ")}])\n`;
      }
    } else if (!c.isClosed) {
      out += `- **Pending Requirements**: ${c.outstandingRequirements.join("; ")}\n`;
    }

    out += `\n`;
  }

  return out;
}
