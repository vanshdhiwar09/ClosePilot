// src/agent/policy.ts
// Deterministic Safety Policy Validator for ClosePilot investigation recommendations.
// Guarantees that agent suggestions cannot bypass accounting controls, exception findings,
// evidence requirements, or human review mandates.

import {
  AgentRecommendation,
  CaseDetail,
  PolicyValidationResult,
  RiskLevel,
} from "./types";

export class PolicyValidator {
  /**
   * Evaluates an agent recommendation against deterministic safety and accounting policies.
   * Returns whether the recommendation is permitted, which rule was evaluated, and whether
   * human review is strictly enforced.
   */
  public static validate(
    recommendation: AgentRecommendation,
    caseDetail: CaseDetail,
    citedEvidenceIds: string[],
    riskLevel: RiskLevel
  ): PolicyValidationResult {
    const exceptions = caseDetail.exceptions.map((e) => e.type);
    const availableEvidenceIds = new Set(caseDetail.evidence.map((e) => e.id));

    // Rule 1: Evidence Citation Integrity
    // The agent must only cite evidence items that actually exist in the case context.
    const invalidCitations = citedEvidenceIds.filter((id) => !availableEvidenceIds.has(id));
    if (invalidCitations.length > 0) {
      return {
        isPermitted: false,
        policyRule: "EVIDENCE_CITATION_INTEGRITY",
        policyReason: `Recommendation rejected: agent cited nonexistent evidence ID(s): [${invalidCitations.join(", ")}].`,
        forcedHumanReview: true,
      };
    }

    // Rule 2: Auto-Resolve Guard
    // The agent cannot recommend NO_ACTION_REQUIRED if the case has open exceptions or requires review.
    if (recommendation.action === "NO_ACTION_REQUIRED") {
      if (!caseDetail.autoResolutionAllowed || exceptions.length > 0) {
        return {
          isPermitted: false,
          policyRule: "AUTO_RESOLVE_GUARD",
          policyReason: "Cannot recommend NO_ACTION_REQUIRED on a case with active reconciliation exceptions.",
          forcedHumanReview: true,
        };
      }
      return {
        isPermitted: true,
        policyRule: "AUTO_RESOLVE_GUARD",
        policyReason: "Auto-reconciled case verified safe with zero exceptions.",
        forcedHumanReview: false,
      };
    }

    // Rule 3: Unmatched Transaction Guard
    // Cannot recommend approving a match when zero candidate ledger entries exist.
    if (exceptions.includes("unmatched_transaction") && recommendation.action === "APPROVE_MATCH") {
      return {
        isPermitted: false,
        policyRule: "UNMATCHED_TRANSACTION_GUARD",
        policyReason: "Cannot recommend APPROVE_MATCH when no candidate ledger entry exists in account.",
        forcedHumanReview: true,
      };
    }

    // Rule 4: Missing Documentation Guard
    // Cannot recommend approving a match when required documentation is missing.
    // Must recommend REQUEST_EVIDENCE.
    if (exceptions.includes("missing_documentation") && recommendation.action === "APPROVE_MATCH") {
      return {
        isPermitted: false,
        policyRule: "MISSING_DOCUMENTATION_GUARD",
        policyReason: "Cannot approve match while required supporting documentation is missing. Evidence must be requested and verified first.",
        forcedHumanReview: true,
      };
    }

    // Rule 5: Ambiguous Candidates Guard
    // Cannot autonomously approve a match when multiple competing entries exist without disambiguation.
    if (
      caseDetail.reconciliationResult.status === "review_required" &&
      caseDetail.candidateLedgerEntries.length > 1 &&
      recommendation.action === "APPROVE_MATCH"
    ) {
      return {
        isPermitted: false,
        policyRule: "AMBIGUOUS_CANDIDATES_GUARD",
        policyReason: "Multiple competing candidates require human review disambiguation before match approval.",
        forcedHumanReview: true,
      };
    }

    // Rule 6: Anomaly Risk Classification Guard
    // A statistical anomaly cannot be classified as LOW risk or bypass controller escalation.
    if (exceptions.includes("potential_anomaly") && riskLevel === "LOW") {
      return {
        isPermitted: false,
        policyRule: "HIGH_VALUE_ANOMALY_GUARD",
        policyReason: "Statistical account anomaly cannot be assessed as LOW risk. High-value outliers require controller scrutiny.",
        forcedHumanReview: true,
      };
    }

    // Rule 7: Permitted Recommendations
    // Valid recommendations (e.g. valid REQUEST_EVIDENCE, APPROVE_MATCH within timing clearance,
    // MANUAL_ENTRY_REQUIRED, PRICE_ADJUSTMENT_REQUIRED, ESCALATE_TO_MANAGEMENT).
    // All exception cases strictly enforce human review.
    return {
      isPermitted: true,
      policyRule: "ACCOUNTING_STANDARD_CLEARANCE",
      policyReason: `Recommendation "${recommendation.action}" complies with deterministic policy controls.`,
      forcedHumanReview: true,
    };
  }
}
