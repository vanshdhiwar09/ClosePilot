// src/workflow/reconciliation-workflow.ts
// End-to-end reconciliation workflow integrating:
// Deterministic Reconciliation -> Autonomous Investigation -> Review Queue -> Human Review State Machine -> Close Package

import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { SupportingDocument, normalizeSupportingDocumentInput } from "../schemas/supporting-document";
import { EvaluationCase } from "../schemas/evaluation-case";
import { loadFixture, loadGroundTruth } from "../schemas/fixture-loader";
import {
  initializePipelineContext,
  reconcileBankTransaction,
  ReconcileTransactionOutput,
} from "../reconciliation/pipeline";
import { AutonomousInvestigator, InvestigatorOptions } from "../agent/investigator";
import { InvestigationContext, ReadOnlyInvestigationToolbox } from "../agent/tools";
import { InvestigationResult } from "../agent/types";
import { HumanReviewSession } from "../review/state-machine";
import { buildReviewQueue } from "../review/queue";
import { generateClosePackage, ClosePackageOptions } from "../review/close-package";
import {
  ApplyActionParams,
  CaseReviewInput,
  ClosePackage,
  ReviewQueueItem,
} from "../review/types";
import {
  InvestigationRunRecorder,
  InMemoryRunRecorder,
  InvestigationRunTrace,
  ObservabilityMetrics,
  calculateObservabilityMetrics,
} from "../observability";

export type EndToEndWorkflowOptions = {
  fixtureName?: string;
  groundTruthVersion?: string;
  fixtureData?: Record<string, unknown>;
  groundTruthData?: Record<string, unknown>;
  investigator?: AutonomousInvestigator;
  investigatorOptions?: InvestigatorOptions;
  recorder?: InvestigationRunRecorder;
  packageOptions?: ClosePackageOptions;
  humanActions?: ApplyActionParams[];
  investigateAutoResolved?: boolean;
};

export type EndToEndWorkflowResult = {
  session: HumanReviewSession;
  investigations: InvestigationResult[];
  reviewQueue: ReviewQueueItem[];
  closePackage: ClosePackage;
  traces: ReadonlyArray<InvestigationRunTrace>;
  observabilityMetrics?: ObservabilityMetrics;
  summary: {
    totalCases: number;
    autoResolvedCases: number;
    investigatedCases: number;
    reviewQueueItems: number;
    closedCases: number;
    openCases: number;
  };
};

/**
 * Executes the complete ClosePilot workflow deterministically:
 * 1. Deterministic Reconciliation
 * 2. Exception / Review identification
 * 3. Autonomous Investigation on applicable cases
 * 4. Human Review Queue construction
 * 5. Optional explicit Human Actions (agent never bypasses human review)
 * 6. Evidence-Backed Close Package generation preserving independent audit layers
 */
export async function runEndToEndReconciliationWorkflow(
  options?: EndToEndWorkflowOptions
): Promise<EndToEndWorkflowResult> {
  const fixtureName = options?.fixtureName || "month-end-reconciliation-2024.1";
  const groundTruthVersion = options?.groundTruthVersion || "2024.1";
  const investigateAutoResolved = options?.investigateAutoResolved ?? false;

  const fixture = (options?.fixtureData || loadFixture(fixtureName)) as any;
  const groundTruth = (options?.groundTruthData || loadGroundTruth(groundTruthVersion)) as any;

  const bankTransactions: BankTransaction[] = fixture.bankTransactions;
  const ledgerEntries: LedgerEntry[] = fixture.ledgerEntries;
  const rawDocs = fixture.documents || fixture.supportingDocuments || [];
  const documents: SupportingDocument[] = Array.isArray(rawDocs)
    ? rawDocs.map((d: any, i: number) => normalizeSupportingDocumentInput(d, i))
    : [];
  const evaluationCases: EvaluationCase[] = groundTruth.evaluationCases;

  const pipelineCtx = initializePipelineContext(bankTransactions, ledgerEntries);
  const recorder =
    options?.recorder ||
    options?.investigatorOptions?.recorder ||
    new InMemoryRunRecorder();

  const investigatorOptions: InvestigatorOptions = {
    ...options?.investigatorOptions,
    recorder,
  };

  const investigator =
    options?.investigator || new AutonomousInvestigator(investigatorOptions);

  // Step 1: Run deterministic reconciliation
  const inputs: CaseReviewInput[] = [];
  const reconcileOutputs = new Map<string, ReconcileTransactionOutput>();
  const caseBankTxMap = new Map<string, string>();
  const casesToInvestigate: string[] = [];
  let autoResolvedCount = 0;

  for (const ec of evaluationCases) {
    const bankTx = bankTransactions.find((b) => b.id === ec.bankTransactionId);
    if (!bankTx) {
      throw new Error(`BankTransaction "${ec.bankTransactionId}" not found in fixture.`);
    }

    const output = reconcileBankTransaction(bankTx, ledgerEntries, documents, pipelineCtx);
    reconcileOutputs.set(bankTx.id, output);
    caseBankTxMap.set(ec.id, bankTx.id);

    const candidateIds = output.result.candidateLedgerEntryIds;
    const candidates = ledgerEntries.filter((e) => candidateIds.includes(e.id));

    const isAutoResolved =
      output.autoResolutionAllowed &&
      output.exceptions.length === 0 &&
      output.result.status === "matched";

    if (isAutoResolved) {
      autoResolvedCount++;
    }

    inputs.push({
      caseId: ec.id,
      bankTransaction: bankTx,
      reconciliationOutput: output,
      candidateLedgerEntries: candidates,
    });

    if (!isAutoResolved || investigateAutoResolved) {
      casesToInvestigate.push(ec.id);
    }
  }

  // Step 2: Initialize HumanReviewSession with cases
  const session = new HumanReviewSession(inputs);

  // Step 3: Run Autonomous Investigation on applicable cases
  const context: InvestigationContext = {
    bankTransactions,
    ledgerEntries,
    documents,
    reconcileOutputs,
    caseBankTxMap,
  };

  const investigations: InvestigationResult[] = [];
  for (const caseId of casesToInvestigate) {
    const toolbox = new ReadOnlyInvestigationToolbox(context);
    const invResult = await investigator.investigateCase(caseId, toolbox);

    investigations.push(invResult);
    // Attach investigation advisory context to the session without changing review state
    session.setInvestigation(caseId, invResult);
  }

  // Step 4: Construct review queue
  const reviewQueue = buildReviewQueue(session, investigations);

  // Step 5: Apply any explicit human actions (if provided by caller)
  if (options?.humanActions && options.humanActions.length > 0) {
    for (const action of options.humanActions) {
      session.applyAction(action);
    }
  }

  // Step 6: Generate evidence-backed close package
  const closePackage = generateClosePackage(session, options?.packageOptions);

  // Summary counts
  const totalCases = inputs.length;
  const closedCases = closePackage.cases.filter((c) => c.isClosed).length;
  const openCases = totalCases - closedCases;

  const traces =
    recorder instanceof InMemoryRunRecorder ? recorder.getTraces() : [];
  const observabilityMetrics =
    traces.length > 0 ? calculateObservabilityMetrics(traces) : undefined;

  return {
    session,
    investigations,
    reviewQueue,
    closePackage,
    traces,
    observabilityMetrics,
    summary: {
      totalCases,
      autoResolvedCases: autoResolvedCount,
      investigatedCases: investigations.length,
      reviewQueueItems: reviewQueue.length,
      closedCases,
      openCases,
    },
  };
}
