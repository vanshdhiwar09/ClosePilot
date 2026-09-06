// src/review/queue.ts
// Reviewer-facing queue context and decision guidance synthesizer for ClosePilot.
// Aggregates grounded reconciliation findings, agent investigation outputs, and policy status
// to clearly answer what happened, why it was flagged, what was investigated, and what the reviewer must decide.

import { HumanReviewSession } from "./state-machine";
import { ReviewQueueItem, ReviewerGuidance, HumanReviewState } from "./types";
import { InvestigationResult } from "../agent/types";

/**
 * Synthesizes reviewer-facing guidance answering the 9 core review questions for a case.
 */
export function buildReviewerGuidance(
  caseCtx: ReturnType<HumanReviewSession["getCase"]>
): ReviewerGuidance {
  const tx = caseCtx.bankTransaction;
  const res = caseCtx.reconciliationOutput.result;
  const exceptions = caseCtx.reconciliationOutput.exceptions.map((e) => e.type);
  const evidenceCount = caseCtx.evidence.length;
  const inv = caseCtx.investigation;

  // 1. What happened?
  const whatHappened = `Bank transaction ${tx.id} for $${tx.amount} (${tx.description || tx.counterparty || "unspecified"}) on ${tx.transactionDate} in account ${tx.accountId}.`;

  // 2. Why did reconciliation flag it?
  const whyFlagged = exceptions.length > 0
    ? exceptions.map((e) => `Exception [${e}]: flagged by reconciliation rule trace.`)
    : [`Status "${res.status}": multiple or ambiguous candidates require manual selection.`];

  // 3. What evidence exists?
  const evidenceSummary = `${evidenceCount} evidence item(s) linked (sources, rules, calculations, documents).`;

  // 4-8. Agent investigation details
  const agentInvestigationSummary = inv?.investigationSummary;
  const agentRecommendation = inv?.recommendation.action;
  const recommendationReason = inv?.recommendation.suggestedReason;
  const riskLevel = inv?.riskLevel;
  const confidence = inv?.confidence;
  const isPolicyPermitted = inv?.policyValidation.isPermitted;
  const policyReason = inv?.policyValidation.policyReason;

  // 9. What does the human need to decide?
  let actionRequired = "Review transaction, verify linked evidence, and choose APPROVE, REJECT, or REQUEST_EVIDENCE.";
  if (caseCtx.currentState === "WAITING_FOR_EVIDENCE") {
    actionRequired = `Case is awaiting evidence (${caseCtx.outstandingEvidenceRequests.join("; ")}). Supply evidence before review.`;
  } else if (inv?.recommendation.action === "REQUEST_EVIDENCE") {
    actionRequired = `Agent recommends requesting evidence (${inv.recommendation.requiredEvidenceTypes?.join(", ") || "documentation"}).`;
  } else if (inv?.recommendation.action === "MANUAL_ENTRY_REQUIRED") {
    actionRequired = "No candidate entry exists; book manual adjusting ledger entry or reject match.";
  } else if (inv?.recommendation.action === "PRICE_ADJUSTMENT_REQUIRED") {
    actionRequired = `Price mismatch detected ($${res.amountDifference}); verify price credit memo before approving.`;
  } else if (inv?.recommendation.action === "ESCALATE_TO_MANAGEMENT") {
    actionRequired = "High-risk or ambiguous case: Controller / management sign-off recommended.";
  }

  return {
    whatHappened,
    whyFlagged,
    evidenceSummary,
    agentInvestigationSummary,
    agentRecommendation,
    recommendationReason,
    riskLevel,
    confidence,
    isPolicyPermitted,
    policyReason,
    actionRequired,
  };
}

/**
 * Builds the reviewer-facing queue items for all active cases requiring human attention.
 */
export function buildReviewQueue(
  session: HumanReviewSession,
  investigations?: InvestigationResult[] | Map<string, InvestigationResult>
): ReviewQueueItem[] {
  const cases = session.listCases();
  const queueItems: ReviewQueueItem[] = [];

  const invMap = Array.isArray(investigations)
    ? new Map(investigations.map((inv) => [inv.caseId, inv]))
    : investigations;

  for (const c of cases) {
    // Exclude auto-resolved cases from the manual review queue unless explicit review needed
    if (c.isAutoResolved) {
      continue;
    }

    // Attach investigation if supplied
    if (invMap && invMap.has(c.caseId)) {
      session.setInvestigation(c.caseId, invMap.get(c.caseId)!);
    }

    const freshCase = session.getCase(c.caseId);
    const guidance = buildReviewerGuidance(freshCase);

    queueItems.push({
      caseId: freshCase.caseId,
      bankTransactionId: freshCase.bankTransaction.id,
      sourceTransaction: freshCase.bankTransaction,
      reconciliationResult: freshCase.reconciliationOutput.result,
      candidateLedgerEntries: freshCase.candidateLedgerEntries,
      exceptions: freshCase.reconciliationOutput.exceptions,
      evidence: freshCase.evidence,
      ruleTrace: freshCase.reconciliationOutput.matchResult?.ruleTrace || [],
      investigation: freshCase.investigation,
      currentState: freshCase.currentState as HumanReviewState,
      decisionHistory: freshCase.decisionHistory,
      outstandingEvidenceRequests: freshCase.outstandingEvidenceRequests,
      guidance,
    });
  }

  return queueItems;
}
