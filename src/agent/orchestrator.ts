// src/agent/orchestrator.ts
// Batch investigation orchestrator and report formatter for ClosePilot Autonomous Investigation Agent.

import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { SupportingDocument } from "../schemas/supporting-document";
import { EvaluationCase } from "../schemas/evaluation-case";
import { loadFixture, loadGroundTruth } from "../schemas/fixture-loader";
import {
  initializePipelineContext,
  reconcileBankTransaction,
  ReconcileTransactionOutput,
} from "../reconciliation/pipeline";
import {
  InvestigationResult,
  RecommendationAction,
  RiskLevel,
} from "./types";
import { InvestigationContext, ReadOnlyInvestigationToolbox } from "./tools";
import { AutonomousInvestigator, InvestigatorOptions } from "./investigator";

export type InvestigationRunSummary = {
  runId: string;
  totalCases: number;
  investigatedCount: number;
  skippedAutoResolvedCount: number;
  policyViolationsCount: number;
  results: InvestigationResult[];
  riskDistribution: Record<RiskLevel, number>;
  recommendationDistribution: Record<RecommendationAction, number>;
  generatedAt: string;
};

export class InvestigationOrchestrator {
  private readonly investigator: AutonomousInvestigator;

  constructor(options?: InvestigatorOptions) {
    this.investigator = new AutonomousInvestigator(options);
  }

  /**
   * Runs investigations across all cases provided in an InvestigationContext.
   */
  public async investigateAll(
    context: InvestigationContext,
    caseIds?: string[]
  ): Promise<InvestigationRunSummary> {
    const runId = `RUN-INV-${Date.now()}`;
    const generatedAt = new Date().toISOString();

    const targetCaseIds =
      caseIds ||
      Array.from(context.caseBankTxMap?.keys() || context.reconcileOutputs.keys());

    const results: InvestigationResult[] = [];
    const riskDistribution: Record<RiskLevel, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    const recommendationDistribution: Record<RecommendationAction, number> = {
      APPROVE_MATCH: 0,
      REJECT_MATCH: 0,
      REQUEST_EVIDENCE: 0,
      MANUAL_ENTRY_REQUIRED: 0,
      PRICE_ADJUSTMENT_REQUIRED: 0,
      ESCALATE_TO_MANAGEMENT: 0,
      NO_ACTION_REQUIRED: 0,
    };

    let investigatedCount = 0;
    let skippedAutoResolvedCount = 0;
    let policyViolationsCount = 0;

    for (const caseId of targetCaseIds) {
      // Create a fresh read-only toolbox per case to record tool calls cleanly
      const toolbox = new ReadOnlyInvestigationToolbox(context);
      const res = await this.investigator.investigateCase(caseId, toolbox);
      results.push(res);

      riskDistribution[res.riskLevel] += 1;
      recommendationDistribution[res.recommendation.action] += 1;

      if (res.outcome === "SKIPPED_AUTO_RESOLVED") {
        skippedAutoResolvedCount += 1;
      } else {
        investigatedCount += 1;
      }

      if (res.outcome === "FAILED_POLICY_CHECK" || !res.policyValidation.isPermitted) {
        policyViolationsCount += 1;
      }
    }

    return {
      runId,
      totalCases: targetCaseIds.length,
      investigatedCount,
      skippedAutoResolvedCount,
      policyViolationsCount,
      results,
      riskDistribution,
      recommendationDistribution,
      generatedAt,
    };
  }

  /**
   * Convenience helper to run full investigation directly against a benchmark fixture.
   */
  public async investigateFixture(
    fixtureName: string = "month-end-reconciliation-2024.1",
    groundTruthVersion: string = "2024.1"
  ): Promise<InvestigationRunSummary> {
    const fixture = loadFixture(fixtureName) as any;
    const groundTruth = loadGroundTruth(groundTruthVersion) as any;

    const bankTransactions: BankTransaction[] = fixture.bankTransactions;
    const ledgerEntries: LedgerEntry[] = fixture.ledgerEntries;
    const documents: SupportingDocument[] = fixture.documents;
    const evaluationCases: EvaluationCase[] = groundTruth.evaluationCases;

    const pipelineCtx = initializePipelineContext(bankTransactions, ledgerEntries);

    const reconcileOutputs = new Map<string, ReconcileTransactionOutput>();
    const caseBankTxMap = new Map<string, string>();

    for (const ec of evaluationCases) {
      const bankTx = bankTransactions.find((b) => b.id === ec.bankTransactionId);
      if (!bankTx) continue;

      const output = reconcileBankTransaction(bankTx, ledgerEntries, documents, pipelineCtx);
      reconcileOutputs.set(bankTx.id, output);
      caseBankTxMap.set(ec.id, bankTx.id);
    }

    const context: InvestigationContext = {
      bankTransactions,
      ledgerEntries,
      documents,
      reconcileOutputs,
      caseBankTxMap,
    };

    return this.investigateAll(context, evaluationCases.map((ec) => ec.id));
  }
}

/**
 * Formats an InvestigationRunSummary into an audit-ready Markdown document.
 */
export function formatInvestigationReportMarkdown(summary: InvestigationRunSummary): string {
  let out = `# ClosePilot Autonomous Investigation Report\n\n`;
  out += `**Run ID**: \`${summary.runId}\`  \n`;
  out += `**Generated At**: ${summary.generatedAt}  \n\n`;

  out += `## 1. Executive Summary\n\n`;
  out += `| Metric | Count |\n`;
  out += `|---|---|\n`;
  out += `| **Total Cases Evaluated** | ${summary.totalCases} |\n`;
  out += `| **Exceptions Investigated** | ${summary.investigatedCount} |\n`;
  out += `| **Auto-Resolved Cases Bypassed** | ${summary.skippedAutoResolvedCount} |\n`;
  out += `| **Policy Interventions / Guardrail Triggers** | ${summary.policyViolationsCount} |\n\n`;

  out += `## 2. Risk & Recommendation Breakdown\n\n`;
  out += `### Risk Distribution\n`;
  for (const [risk, count] of Object.entries(summary.riskDistribution)) {
    out += `- **${risk}**: ${count}\n`;
  }

  out += `\n### Recommendation Distribution\n`;
  for (const [action, count] of Object.entries(summary.recommendationDistribution)) {
    out += `- \`${action}\`: ${count}\n`;
  }

  out += `\n## 3. Case Investigation Findings\n\n`;
  out += `| Case ID | Bank Tx | Risk | Action | Policy Clearance | Root Cause |\n`;
  out += `|---|---|---|---|---|---|\n`;

  for (const r of summary.results) {
    const policyIcon = r.policyValidation.isPermitted ? "✅ PERMITTED" : "⚠️ BLOCKED";
    out += `| **${r.caseId}** | ${r.bankTransactionId} | \`${r.riskLevel}\` | \`${r.recommendation.action}\` | ${policyIcon} | ${r.rootCause} |\n`;
  }

  out += `\n## 4. Case Detailed Analysis & Observability Trace\n\n`;
  for (const r of summary.results) {
    out += `### Case ${r.caseId} (${r.bankTransactionId})\n`;
    out += `- **Investigation Outcome**: \`${r.outcome}\`\n`;
    out += `- **Summary**: ${r.investigationSummary}\n`;
    out += `- **Root Cause**: ${r.rootCause}\n`;
    out += `- **Recommendation**: \`${r.recommendation.action}\` — "${r.recommendation.suggestedReason}"\n`;
    out += `- **Risk Level**: \`${r.riskLevel}\` | **Confidence**: \`${r.confidence}\` | **Human Review Mandate**: ${r.requiresHumanReview ? "YES" : "NO"}\n`;
    out += `- **Policy Validation**: ${r.policyValidation.isPermitted ? "PASSED" : "FAILED"} (${r.policyValidation.policyRule}: ${r.policyValidation.policyReason})\n`;
    out += `- **Reasoning Steps (${r.reasoningTrace.length})**:\n`;
    for (const step of r.reasoningTrace) {
      out += `  - ${step}\n`;
    }
    out += `- **Tool Calls Executed (${r.toolCalls.length})**:\n`;
    for (const tc of r.toolCalls) {
      out += `  - \`${tc.toolName}\` (${tc.durationMs.toFixed(2)}ms)\n`;
    }
    out += `\n`;
  }

  return out;
}
