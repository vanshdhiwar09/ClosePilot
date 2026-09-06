// tests/unit/policy-integration.test.ts
// Tests for Phase 5B Policy Guardrails, Safety Enforcement, and Auditability

import { describe, it, expect } from "vitest";
import { AutonomousInvestigator } from "../../src/agent/investigator";
import { CustomMockProvider, DeterministicMockProvider } from "../../src/agent/provider";
import { ReadOnlyInvestigationToolbox, InvestigationContext } from "../../src/agent/tools";
import { loadFixture, loadGroundTruth } from "../../src/schemas/fixture-loader";
import {
  initializePipelineContext,
  reconcileBankTransaction,
  ReconcileTransactionOutput,
} from "../../src/reconciliation/pipeline";
import { BankTransaction } from "../../src/schemas/bank-transaction";
import { LedgerEntry } from "../../src/schemas/ledger-entry";
import { SupportingDocument } from "../../src/schemas/supporting-document";
import { EvaluationCase } from "../../src/schemas/evaluation-case";

function setupContext() {
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

  return { context, evaluationCases };
}

describe("Phase 5B Policy Integration & Safety Enforcement", () => {
  it("preserves raw model recommendation when policy blocks unsafe model APPROVE on missing documentation", async () => {
    const { context } = setupContext();

    // Custom model provider that unsafely attempts to APPROVE_MATCH for EC006 (missing documentation)
    const unsafeProvider = new CustomMockProvider(async (prompt) => {
      return {
        summary: "Unsafely approving despite missing documents.",
        rootCause: "Model hallucination ignoring document requirement.",
        reasoning: ["Ignoring audit rule."],
        recommendedAction: "APPROVE_MATCH",
        suggestedReason: "Approve without invoice.",
        confidence: "HIGH",
        riskLevel: "LOW",
        citedEvidenceIds: [],
      };
    });

    const investigator = new AutonomousInvestigator({ modelProvider: unsafeProvider });
    const toolbox = new ReadOnlyInvestigationToolbox(context);

    const result = await investigator.investigateCase("EC006", toolbox);

    // 1. Policy must reject the recommendation
    expect(result.policyValidation.isPermitted).toBe(false);
    expect(result.policyValidation.forcedHumanReview).toBe(true);
    expect(result.policyValidation.policyRule).toBe("MISSING_DOCUMENTATION_GUARD");

    // 2. Final recommendation is overridden to ESCALATE_TO_MANAGEMENT
    expect(result.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");
    expect(result.requiresHumanReview).toBe(true);

    // 3. Raw model recommendation remains fully auditable
    expect(result.rawModelRecommendation).toBeDefined();
    expect(result.rawModelRecommendation?.action).toBe("APPROVE_MATCH");
    expect(result.rawModelRecommendation?.suggestedReason).toBe("Approve without invoice.");
  });

  it("blocks unsafe model APPROVE on potential anomaly case EC007", async () => {
    const { context } = setupContext();

    // Custom provider attempting to approve $15,000 statistical outlier
    const unsafeProvider = new CustomMockProvider(async () => ({
      summary: "Approving anomaly without controller sign-off.",
      rootCause: "Ignoring anomaly baseline.",
      reasoning: ["Skip review."],
      recommendedAction: "APPROVE_MATCH",
      suggestedReason: "Auto-approve high value.",
      confidence: "HIGH",
      riskLevel: "LOW",
      citedEvidenceIds: [],
    }));

    const investigator = new AutonomousInvestigator({ modelProvider: unsafeProvider });
    const toolbox = new ReadOnlyInvestigationToolbox(context);

    const result = await investigator.investigateCase("EC007", toolbox);

    expect(result.policyValidation.isPermitted).toBe(false);
    expect(result.policyValidation.policyRule).toBe("HIGH_VALUE_ANOMALY_GUARD");
    expect(result.policyValidation.forcedHumanReview).toBe(true);
    expect(result.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");
    expect(result.rawModelRecommendation?.action).toBe("APPROVE_MATCH");
  });

  it("blocks unsafe model APPROVE on ambiguous candidates case EC008", async () => {
    const { context } = setupContext();

    // Custom provider attempting to approve without human candidate disambiguation
    const unsafeProvider = new CustomMockProvider(async () => ({
      summary: "Arbitrarily picking one of two equal candidates.",
      rootCause: "Ignoring candidate ambiguity.",
      reasoning: ["Pick LE008a arbitrarily."],
      recommendedAction: "APPROVE_MATCH",
      suggestedReason: "Pick candidate blindly.",
      confidence: "HIGH",
      riskLevel: "LOW",
      citedEvidenceIds: [],
    }));

    const investigator = new AutonomousInvestigator({ modelProvider: unsafeProvider });
    const toolbox = new ReadOnlyInvestigationToolbox(context);

    const result = await investigator.investigateCase("EC008", toolbox);

    expect(result.policyValidation.isPermitted).toBe(false);
    expect(result.policyValidation.policyRule).toBe("AMBIGUOUS_CANDIDATES_GUARD");
    expect(result.policyValidation.forcedHumanReview).toBe(true);
    expect(result.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");
    expect(result.rawModelRecommendation?.action).toBe("APPROVE_MATCH");
  });

  it("permits safe recommendation and maintains bounded tool execution with enforced human review", async () => {
    const { context } = setupContext();
    const investigator = new AutonomousInvestigator({
      maxToolCalls: 3,
      modelProvider: new DeterministicMockProvider(),
    });

    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const result = await investigator.investigateCase("EC004", toolbox);

    expect(result.policyValidation.isPermitted).toBe(true);
    expect(result.policyValidation.policyRule).toBe("ACCOUNTING_STANDARD_CLEARANCE");
    // Exception cases strictly require human review
    expect(result.policyValidation.forcedHumanReview).toBe(true);
    expect(result.recommendation.action).toBe("APPROVE_MATCH");
    expect(result.toolCalls.length).toBeLessThanOrEqual(3);
  });
});
