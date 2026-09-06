// src/observability/types.ts
// Structured domain types and Zod schemas for ClosePilot Autonomous Investigation observability.
// Captures full lifecycle events, tool calls, policy evaluations, and end-to-end run traces.

import { z } from "zod";
import {
  AgentRecommendation,
  agentRecommendationSchema,
  InvestigationConfidence,
  investigationConfidenceSchema,
  InvestigationOutcome,
  investigationOutcomeSchema,
  RiskLevel,
  riskLevelSchema,
  ToolCallRecord,
  toolCallRecordSchema,
} from "../agent/types";

// ==========================================
// Lifecycle Event Types
// ==========================================

export type InvestigationLifecycleEventType =
  | "investigation_started"
  | "investigation_skipped"
  | "tool_called"
  | "tool_completed"
  | "policy_evaluated"
  | "recommendation_generated"
  | "investigation_completed"
  | "investigation_failed";

export const investigationLifecycleEventTypeSchema = z.enum([
  "investigation_started",
  "investigation_skipped",
  "tool_called",
  "tool_completed",
  "policy_evaluated",
  "recommendation_generated",
  "investigation_completed",
  "investigation_failed",
]);

export type InvestigationLifecycleEvent = {
  eventId: string;
  runId: string;
  caseId: string;
  eventType: InvestigationLifecycleEventType;
  timestamp: string;
  payload: Record<string, unknown>;
};

export const investigationLifecycleEventSchema = z.object({
  eventId: z.string(),
  runId: z.string(),
  caseId: z.string(),
  eventType: investigationLifecycleEventTypeSchema,
  timestamp: z.string(),
  payload: z.record(z.unknown()),
});

// ==========================================
// Policy Evaluation Trace Record
// ==========================================

export type PolicyEvaluationRecord = {
  policyRule: string;
  isPermitted: boolean;
  policyReason: string;
  forcedHumanReview: boolean;
  timestamp: string;
  context?: Record<string, unknown>;
};

export const policyEvaluationRecordSchema = z.object({
  policyRule: z.string(),
  isPermitted: z.boolean(),
  policyReason: z.string(),
  forcedHumanReview: z.boolean(),
  timestamp: z.string(),
  context: z.record(z.unknown()).optional(),
});

// ==========================================
// Investigation Run Trace
// ==========================================

export type InvestigationRunTrace = {
  runId: string;
  caseId: string;
  bankTransactionId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  provider: string;
  outcome: InvestigationOutcome;
  recommendation: AgentRecommendation;
  rawModelRecommendation?: AgentRecommendation;
  confidence: InvestigationConfidence;
  riskLevel: RiskLevel;
  requiresHumanReview: boolean;
  toolCalls: ToolCallRecord[];
  policyEvaluations: PolicyEvaluationRecord[];
  evidenceIds: string[];
  events: InvestigationLifecycleEvent[];
  error?: {
    message: string;
    stack?: string;
  };
  metadata: Record<string, unknown>;
};

export const investigationRunTraceSchema = z.object({
  runId: z.string(),
  caseId: z.string(),
  bankTransactionId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  durationMs: z.number(),
  provider: z.string(),
  outcome: investigationOutcomeSchema,
  recommendation: agentRecommendationSchema,
  rawModelRecommendation: agentRecommendationSchema.optional(),
  confidence: investigationConfidenceSchema,
  riskLevel: riskLevelSchema,
  requiresHumanReview: z.boolean(),
  toolCalls: z.array(toolCallRecordSchema),
  policyEvaluations: z.array(policyEvaluationRecordSchema),
  evidenceIds: z.array(z.string()),
  events: z.array(investigationLifecycleEventSchema),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()),
});

// ==========================================
// Observability Metrics
// ==========================================

export type ObservabilityMetrics = {
  totalRuns: number;
  completedRuns: number;
  skippedRuns: number;
  failedRuns: number;
  averageDurationMs: number;
  averageToolCalls: number;
  policyEvaluationsCount: number;
  policyBlocksCount: number;
  forcedHumanReviewCount: number;
};

export const observabilityMetricsSchema = z.object({
  totalRuns: z.number(),
  completedRuns: z.number(),
  skippedRuns: z.number(),
  failedRuns: z.number(),
  averageDurationMs: z.number(),
  averageToolCalls: z.number(),
  policyEvaluationsCount: z.number(),
  policyBlocksCount: z.number(),
  forcedHumanReviewCount: z.number(),
});
