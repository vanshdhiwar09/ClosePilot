// tests/unit/investigation-agent.test.ts
// Comprehensive unit tests for ClosePilot Autonomous Investigation Agent,
// policy guardrails, bounded investigation loops, and fixture execution.

import { describe, it, expect } from "vitest";
import { AutonomousInvestigator } from "../../src/agent/investigator";
import {
  InvestigationOrchestrator,
  formatInvestigationReportMarkdown,
} from "../../src/agent/orchestrator";
import { CustomMockProvider, DeterministicMockProvider } from "../../src/agent/provider";
import { PolicyValidator } from "../../src/agent/policy";
import { ReadOnlyInvestigationToolbox, InvestigationContext } from "../../src/agent/tools";
import { loadFixture, loadGroundTruth } from "../../src/schemas/fixture-loader";
import { BankTransaction } from "../../src/schemas/bank-transaction";
import { LedgerEntry } from "../../src/schemas/ledger-entry";
import { SupportingDocument } from "../../src/schemas/supporting-document";
import { EvaluationCase } from "../../src/schemas/evaluation-case";
import {
  initializePipelineContext,
  reconcileBankTransaction,
  ReconcileTransactionOutput,
} from "../../src/reconciliation/pipeline";

describe("Autonomous Investigation Agent Foundation", () => {
  // Helper to load 2024.1 fixture and build investigation context
  const buildFixtureContext = (): {
    context: InvestigationContext;
    evaluationCases: EvaluationCase[];
  } => {
    const fixture = loadFixture("month-end-reconciliation-2024.1") as any;
    const groundTruth = loadGroundTruth("2024.1") as any;

    const bankTransactions: BankTransaction[] = fixture.bankTransactions;
    const ledgerEntries: LedgerEntry[] = fixture.ledgerEntries;
    const documents: SupportingDocument[] = fixture.documents;
    const evaluationCases: EvaluationCase[] = groundTruth.evaluationCases;

    const pipelineCtx = initializePipelineContext(bankTransactions, ledgerEntries);

    const reconcileOutputs = new Map<string, ReconcileTransactionOutput>();
    const caseBankTxMap = new Map<string, string>();

    for (const ec of evaluationCases) {
      const bankTx = bankTransactions.find((b) => b.id === ec.bankTransactionId)!;
      const output = reconcileBankTransaction(bankTx, ledgerEntries, documents, pipelineCtx);
      reconcileOutputs.set(bankTx.id, output);
      caseBankTxMap.set(ec.id, bankTx.id);
    }

    return {
      context: {
        bankTransactions,
        ledgerEntries,
        documents,
        reconcileOutputs,
        caseBankTxMap,
      },
      evaluationCases,
    };
  };

  it("bypasses auto-resolved case BT001 (EC001) safely without deep investigation", async () => {
    const { context } = buildFixtureContext();
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const investigator = new AutonomousInvestigator();

    const result = await investigator.investigateCase("EC001", toolbox);

    expect(result.outcome).toBe("SKIPPED_AUTO_RESOLVED");
    expect(result.recommendation.action).toBe("NO_ACTION_REQUIRED");
    expect(result.requiresHumanReview).toBe(false);
    expect(result.riskLevel).toBe("LOW");
    expect(result.confidence).toBe("HIGH");
    expect(result.policyValidation.isPermitted).toBe(true);
    expect(result.policyValidation.policyRule).toBe("AUTO_RESOLVE_GUARD");
  });

  it("investigates BT002 (EC002 - unmatched transaction) and recommends manual entry", async () => {
    const { context } = buildFixtureContext();
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const investigator = new AutonomousInvestigator();

    const result = await investigator.investigateCase("EC002", toolbox);

    expect(result.outcome).toBe("COMPLETED");
    expect(result.bankTransactionId).toBe("BT002");
    expect(result.recommendation.action).toBe("MANUAL_ENTRY_REQUIRED");
    expect(result.riskLevel).toBe("HIGH");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.policyValidation.isPermitted).toBe(true);
    expect(result.rootCause).toContain("No candidate entry found in account Acct456");
  });

  it("investigates BT003 (EC003 - amount mismatch) and recommends price adjustment", async () => {
    const { context } = buildFixtureContext();
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const investigator = new AutonomousInvestigator();

    const result = await investigator.investigateCase("EC003", toolbox);

    expect(result.outcome).toBe("COMPLETED");
    expect(result.recommendation.action).toBe("PRICE_ADJUSTMENT_REQUIRED");
    expect(result.recommendation.targetLedgerEntryId).toBe("LE003");
    expect(result.riskLevel).toBe("MEDIUM");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.rootCause).toContain("$250.00 variance");
  });

  it("investigates BT004 (EC004 - timing difference) and recommends approval within window", async () => {
    const { context } = buildFixtureContext();
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const investigator = new AutonomousInvestigator();

    const result = await investigator.investigateCase("EC004", toolbox);

    expect(result.outcome).toBe("COMPLETED");
    expect(result.recommendation.action).toBe("APPROVE_MATCH");
    expect(result.recommendation.targetLedgerEntryId).toBe("LE001");
    expect(result.riskLevel).toBe("LOW");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.rootCause).toContain("differ by 1 day");
  });

  it("investigates BT005 (EC005 - duplicate) and recommends match with subledger voiding", async () => {
    const { context } = buildFixtureContext();
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const investigator = new AutonomousInvestigator();

    const result = await investigator.investigateCase("EC005", toolbox);

    expect(result.outcome).toBe("COMPLETED");
    expect(result.recommendation.action).toBe("APPROVE_MATCH");
    expect(result.recommendation.targetLedgerEntryId).toBe("LE005");
    expect(result.rootCause).toContain("duplicate");
  });

  it("investigates BT006 (EC006 - missing documentation) and recommends requesting evidence", async () => {
    const { context } = buildFixtureContext();
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const investigator = new AutonomousInvestigator();

    const result = await investigator.investigateCase("EC006", toolbox);

    expect(result.outcome).toBe("COMPLETED");
    expect(result.recommendation.action).toBe("REQUEST_EVIDENCE");
    expect(result.recommendation.requiredEvidenceTypes).toEqual(["invoice", "receipt"]);
    expect(result.rootCause).toContain("supporting document");
  });

  it("investigates BT007 (EC007 - potential anomaly) and escalates $15k to management", async () => {
    const { context } = buildFixtureContext();
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const investigator = new AutonomousInvestigator();

    const result = await investigator.investigateCase("EC007", toolbox);

    expect(result.outcome).toBe("COMPLETED");
    expect(result.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");
    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.rootCause).toContain("$15,000.00 is a statistical outlier");
  });

  it("investigates BT008 (EC008 - ambiguous candidates) and escalates for human disambiguation", async () => {
    const { context } = buildFixtureContext();
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const investigator = new AutonomousInvestigator();

    const result = await investigator.investigateCase("EC008", toolbox);

    expect(result.outcome).toBe("COMPLETED");
    expect(result.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");
    expect(result.rootCause).toContain("Multiple ledger entries share identical amounts");
  });

  it("enforces maxToolCalls limit to prevent unbounded tool loops", async () => {
    const { context } = buildFixtureContext();
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const investigator = new AutonomousInvestigator();

    // Constrain tool calls to 2 max
    const result = await investigator.investigateCase("EC006", toolbox, { maxToolCalls: 2 });

    expect(result.toolCalls.length).toBeLessThanOrEqual(2);
  });

  describe("Safety Policy Guardrails & Override Behavior", () => {
    it("policy blocks model attempting to approve match on unmatched transaction", async () => {
      const { context } = buildFixtureContext();
      const toolbox = new ReadOnlyInvestigationToolbox(context);

      // Malicious or hallucinating model recommends APPROVE_MATCH for BT002 (unmatched)
      const unsafeProvider = new CustomMockProvider(async (prompt) => ({
        summary: "Hallucinated match",
        rootCause: "Model hallucinated an entry",
        reasoning: ["Just approve it"],
        recommendedAction: "APPROVE_MATCH", // UNSAFE!
        suggestedReason: "Approve without candidate",
        confidence: "HIGH",
        riskLevel: "LOW",
        citedEvidenceIds: prompt.caseDetail.evidence.map((e) => e.id),
      }));

      const investigator = new AutonomousInvestigator({ modelProvider: unsafeProvider });
      const result = await investigator.investigateCase("EC002", toolbox);

      expect(result.outcome).toBe("FAILED_POLICY_CHECK");
      expect(result.policyValidation.isPermitted).toBe(false);
      expect(result.policyValidation.policyRule).toBe("UNMATCHED_TRANSACTION_GUARD");
      expect(result.policyValidation.forcedHumanReview).toBe(true);

      // Overridden to safe escalation
      expect(result.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");
      expect(result.requiresHumanReview).toBe(true);
    });

    it("policy blocks model attempting to approve match while documentation is missing", async () => {
      const { context } = buildFixtureContext();
      const toolbox = new ReadOnlyInvestigationToolbox(context);

      // Model recommends APPROVE_MATCH on BT006 (missing documentation)
      const unsafeProvider = new CustomMockProvider(async (prompt) => ({
        summary: "Unsafe doc approval",
        rootCause: "Ignored missing doc",
        reasoning: ["Doc not needed"],
        recommendedAction: "APPROVE_MATCH", // UNSAFE!
        suggestedReason: "Ignore missing receipt",
        confidence: "HIGH",
        riskLevel: "LOW",
        citedEvidenceIds: prompt.caseDetail.evidence.map((e) => e.id),
      }));

      const investigator = new AutonomousInvestigator({ modelProvider: unsafeProvider });
      const result = await investigator.investigateCase("EC006", toolbox);

      expect(result.outcome).toBe("FAILED_POLICY_CHECK");
      expect(result.policyValidation.isPermitted).toBe(false);
      expect(result.policyValidation.policyRule).toBe("MISSING_DOCUMENTATION_GUARD");
      expect(result.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");
    });

    it("policy blocks model citing nonexistent or hallucinated evidence IDs", async () => {
      const { context } = buildFixtureContext();
      const toolbox = new ReadOnlyInvestigationToolbox(context);

      // Model cites hallucinated evidence ID
      const hallucinatingProvider = new CustomMockProvider(async () => ({
        summary: "Fake citation",
        rootCause: "Fake",
        reasoning: ["Fake citation"],
        recommendedAction: "REQUEST_EVIDENCE",
        suggestedReason: "Valid reason",
        confidence: "HIGH",
        riskLevel: "MEDIUM",
        citedEvidenceIds: ["EVD-HALLUCINATED-999"], // BOGUS!
      }));

      const investigator = new AutonomousInvestigator({ modelProvider: hallucinatingProvider });
      const result = await investigator.investigateCase("EC006", toolbox);

      expect(result.outcome).toBe("FAILED_POLICY_CHECK");
      expect(result.policyValidation.isPermitted).toBe(false);
      expect(result.policyValidation.policyRule).toBe("EVIDENCE_CITATION_INTEGRITY");
      expect(result.policyValidation.policyReason).toContain("EVD-HALLUCINATED-999");
    });

    it("policy blocks classifying statistical anomaly as LOW risk", async () => {
      const { context } = buildFixtureContext();
      const toolbox = new ReadOnlyInvestigationToolbox(context);

      // Model classifies $15k anomaly as LOW risk
      const lowRiskProvider = new CustomMockProvider(async (prompt) => ({
        summary: "Low risk claim",
        rootCause: "Ignore $15k size",
        reasoning: ["It's fine"],
        recommendedAction: "ESCALATE_TO_MANAGEMENT",
        suggestedReason: "Normal review",
        confidence: "HIGH",
        riskLevel: "LOW", // UNSAFE for anomaly!
        citedEvidenceIds: prompt.caseDetail.evidence.map((e) => e.id),
      }));

      const investigator = new AutonomousInvestigator({ modelProvider: lowRiskProvider });
      const result = await investigator.investigateCase("EC007", toolbox);

      expect(result.outcome).toBe("FAILED_POLICY_CHECK");
      expect(result.policyValidation.isPermitted).toBe(false);
      expect(result.policyValidation.policyRule).toBe("HIGH_VALUE_ANOMALY_GUARD");
    });
  });

  describe("InvestigationOrchestrator & Batch Execution", () => {
    it("runs complete investigation batch across 2024.1 fixture and generates markdown report", async () => {
      const orchestrator = new InvestigationOrchestrator();
      const summary = await orchestrator.investigateFixture("month-end-reconciliation-2024.1", "2024.1");

      expect(summary.totalCases).toBe(8);
      expect(summary.skippedAutoResolvedCount).toBe(1); // BT001 skipped
      expect(summary.investigatedCount).toBe(7); // BT002-BT008 investigated
      expect(summary.policyViolationsCount).toBe(0); // 100% policy clearance on deterministic provider
      expect(summary.results).toHaveLength(8);

      // Risk breakdown
      expect(summary.riskDistribution.LOW).toBe(2); // BT001 (auto) + BT004 (timing)
      expect(summary.riskDistribution.MEDIUM).toBe(3); // BT003 + BT005 + BT006
      expect(summary.riskDistribution.HIGH).toBe(2); // BT002 + BT008
      expect(summary.riskDistribution.CRITICAL).toBe(1); // BT007

      // Format markdown report
      const md = formatInvestigationReportMarkdown(summary);
      expect(md).toContain("# ClosePilot Autonomous Investigation Report");
      expect(md).toContain("**Total Cases Evaluated** | 8");
      expect(md).toContain("**Exceptions Investigated** | 7");
      expect(md).toContain("**Auto-Resolved Cases Bypassed** | 1");
      expect(md).toContain("BT001");
      expect(md).toContain("BT007");
      expect(md).toContain("CRITICAL");
      expect(md).toContain("✅ PERMITTED");
    });
  });
});
