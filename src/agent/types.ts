// src/agent/types.ts
// Canonical types and enums for ClosePilot Autonomous Investigation Agent.

import { z } from "zod";
import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { ReconciliationResult } from "../schemas/reconciliation-result";
import { Exception } from "../schemas/exception";
import { EvidenceItem } from "../schemas/evidence-item";
import { RuleTraceStep } from "../reconciliation/types";
import { HumanReviewDecision } from "../review/types";

// ==========================================
// Recommendation & Outcome Types
// ==========================================

export type RecommendationAction =
  | "APPROVE_MATCH"
  | "REJECT_MATCH"
  | "REQUEST_EVIDENCE"
  | "MANUAL_ENTRY_REQUIRED"
  | "PRICE_ADJUSTMENT_REQUIRED"
  | "ESCALATE_TO_MANAGEMENT"
  | "NO_ACTION_REQUIRED";

export const recommendationActionSchema = z.enum([
  "APPROVE_MATCH",
  "REJECT_MATCH",
  "REQUEST_EVIDENCE",
  "MANUAL_ENTRY_REQUIRED",
  "PRICE_ADJUSTMENT_REQUIRED",
  "ESCALATE_TO_MANAGEMENT",
  "NO_ACTION_REQUIRED",
]);

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export type InvestigationConfidence = "HIGH" | "MEDIUM" | "LOW";

export const investigationConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

export type InvestigationOutcome =
  | "COMPLETED"
  | "SKIPPED_AUTO_RESOLVED"
  | "FAILED_POLICY_CHECK"
  | "FAILED_EXECUTION";

export const investigationOutcomeSchema = z.enum([
  "COMPLETED",
  "SKIPPED_AUTO_RESOLVED",
  "FAILED_POLICY_CHECK",
  "FAILED_EXECUTION",
]);

// ==========================================
// Observability: Tool Calls & Audit Trace
// ==========================================

export type ToolCallRecord = {
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  timestamp: string;
  durationMs: number;
};

export const toolCallRecordSchema = z.object({
  toolName: z.string(),
  input: z.record(z.unknown()),
  output: z.unknown().optional(),
  timestamp: z.string(),
  durationMs: z.number(),
});

// ==========================================
// Canonical Investigation Result
// ==========================================

export type AgentRecommendation = {
  action: RecommendationAction;
  targetLedgerEntryId?: string;
  suggestedReason: string;
  requiredEvidenceTypes?: string[];
};

export const agentRecommendationSchema = z.object({
  action: recommendationActionSchema,
  targetLedgerEntryId: z.string().optional(),
  suggestedReason: z.string().min(1, "Suggested reason cannot be empty"),
  requiredEvidenceTypes: z.array(z.string()).optional(),
});

export type PolicyValidationResult = {
  isPermitted: boolean;
  policyRule: string;
  policyReason: string;
  forcedHumanReview: boolean;
};

export const policyValidationResultSchema = z.object({
  isPermitted: z.boolean(),
  policyRule: z.string(),
  policyReason: z.string(),
  forcedHumanReview: z.boolean(),
});

export type InvestigationResult = {
  investigationId: string;
  caseId: string;
  bankTransactionId: string;
  outcome: InvestigationOutcome;
  investigationSummary: string;
  rootCause: string;
  evidenceIds: string[];
  reasoningTrace: string[];
  recommendation: AgentRecommendation;
  confidence: InvestigationConfidence;
  riskLevel: RiskLevel;
  requiresHumanReview: boolean;
  policyValidation: PolicyValidationResult;
  investigatedAt: string;
  toolCalls: ToolCallRecord[];
  metadata?: Record<string, unknown>;
};

export const investigationResultSchema = z.object({
  investigationId: z.string(),
  caseId: z.string(),
  bankTransactionId: z.string(),
  outcome: investigationOutcomeSchema,
  investigationSummary: z.string(),
  rootCause: z.string(),
  evidenceIds: z.array(z.string()),
  reasoningTrace: z.array(z.string()),
  recommendation: agentRecommendationSchema,
  confidence: investigationConfidenceSchema,
  riskLevel: riskLevelSchema,
  requiresHumanReview: z.boolean(),
  policyValidation: policyValidationResultSchema,
  investigatedAt: z.string(),
  toolCalls: z.array(toolCallRecordSchema),
  metadata: z.record(z.unknown()).optional(),
});

// ==========================================
// Case Context for Tool Execution
// ==========================================

export type CaseDetail = {
  caseId: string;
  bankTransaction: BankTransaction;
  reconciliationResult: ReconciliationResult;
  candidateLedgerEntries: LedgerEntry[];
  exceptions: Exception[];
  evidence: EvidenceItem[];
  ruleTrace: RuleTraceStep[];
  autoResolutionAllowed: boolean;
  humanReviewHistory: HumanReviewDecision[];
};
