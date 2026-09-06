# ClosePilot Phase 6: Observability, Run Logging & Neatlogs Integration

## 1. Overview & Architecture

ClosePilot's Phase 6 Observability Layer provides comprehensive, production-grade telemetry for autonomous investigation runs without compromising financial determinism, data integrity, or audit safety.

```
+-----------------------------------------------------------------------------+
|                      Deterministic Reconciliation Layer                     |
|           (Source of Truth: Math, Accounting Rules, Matching Engine)        |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
|                     Autonomous Investigation Agent (Advisory)                |
|  - Read-Only Investigation Toolbox                                          |
|  - LLM Provider (Deterministic Benchmark / Google Gemini)                   |
|  - Deterministic PolicyValidator (Safety Guardrails)                        |
+-----------------------------------------------------------------------------+
                                       |
                      Emits structured lifecycle events
                                       |
                                       v
+-----------------------------------------------------------------------------+
|                       Observability & Tracing Layer                         |
|   src/observability/                                                        |
|   +-----------------------------------------------------------------------+ |
|   | InvestigationLifecycleEvent  |  InvestigationRunTrace  |  Metrics     | |
|   +-----------------------------------------------------------------------+ |
|                                      |                                      |
|                +---------------------+---------------------+                |
|                |                                           |                |
|                v                                           v                |
|     [ InMemoryRunRecorder ]                     [ LocalJsonRunRecorder ]    |
|   (Fast, offline unit tests)                  (.logs/investigations/*.json) |
|                                                            |                |
|                                                            v                |
|                                                 [ NeatlogsRunRecorder ]     |
|                                            (Live Cloud Telemetry / Ingest)  |
+-----------------------------------------------------------------------------+
```

### Core Design Principles
1. **Strict Accounting Independence**: The observability layer operates strictly out-of-band. Observability metrics (`averageDurationMs`, `policyBlocksCount`, `toolCallsCount`) are kept separate from financial accuracy metrics (`f1Score`, `matchAccuracy`).
2. **Non-Fatal Failure Isolation**: Failures in log emission, disk I/O, network transport, or external telemetry ingestion (e.g. Neatlogs API unavailability) are completely non-fatal and will never fail or delay month-end financial reconciliation.
3. **Audit Trail Linkage**: Traces map 1:1 with `ReviewQueueItem` and close package items via `trace.runId === investigation.investigationId`.
4. **Credential & Sensitive Data Redaction**: Automatic regex scrubbing guarantees that API tokens (`AIza...`, `nl_...`, `Bearer ...`) are never persisted in traces or logs.

---

## 2. Investigation Run Trace Data Model

The canonical trace model is defined in `src/observability/types.ts` and validated via Zod (`investigationRunTraceSchema`):

```typescript
export type InvestigationRunTrace = {
  runId: string;                     // e.g. "INV-EC004-1725612345678"
  caseId: string;                    // e.g. "EC004"
  bankTransactionId: string;         // e.g. "BT004"
  startTime: string;                 // ISO 8601 UTC timestamp
  endTime: string;                   // ISO 8601 UTC timestamp
  durationMs: number;                // Wall-clock run duration in ms
  provider: string;                  // "deterministic_mock_provider" | "gemini_rest_provider_gemini-2.5-flash"
  outcome: InvestigationOutcome;     // "COMPLETED" | "SKIPPED_AUTO_RESOLVED" | "FAILED_POLICY_CHECK" | "FAILED_EXECUTION"
  recommendation: AgentRecommendation; // Sanitized actionable recommendation
  rawModelRecommendation?: AgentRecommendation; // Original model output prior to policy override
  confidence: "HIGH" | "MEDIUM" | "LOW";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requiresHumanReview: boolean;      // Guaranteed true for all exception investigations
  toolCalls: ToolCallRecord[];       // Ordered list of tools called with inputs, outputs, duration
  policyEvaluations: PolicyEvaluationRecord[]; // Guardrail evaluations
  evidenceIds: string[];             // Cited evidence items
  events: InvestigationLifecycleEvent[]; // Complete chronological sequence of lifecycle events
  error?: {
    message: string;
    stack?: string;
  };
  metadata: Record<string, unknown>; // Case metadata, environment flags, runtime stats
};
```

---

## 3. Investigation Lifecycle Events

ClosePilot captures an explicit timeline of events for every investigation lifecycle:

| Event Type | Emitted When | Payload Details |
|---|---|---|
| `investigation_started` | Agent begins analyzing a case | `{ caseId }` |
| `investigation_skipped` | Auto-resolved exact matches bypass deep LLM execution | `{ caseId, bankTransactionId, reason }` |
| `tool_called` | Prior to executing a read-only investigation tool | `{ toolName, caseId, ledgerEntryId, ... }` |
| `tool_completed` | After read-only tool returns | `{ toolName, count, matchCount, ... }` |
| `policy_evaluated` | After deterministic `PolicyValidator.validate` executes | `{ policyRule, isPermitted, policyReason, forcedHumanReview }` |
| `recommendation_generated`| Recommendation formulated and sanitized | `{ action, suggestedReason, confidence, riskLevel, isPermitted, rawModelAction }` |
| `investigation_completed` | Successful run completion | `{ outcome, durationMs, requiresHumanReview }` |
| `investigation_failed` | Unhandled exception during tool/model execution | `{ error, stack }` |

---

## 4. Pluggable Recorders

### 1. `InMemoryRunRecorder`
Default recorder used for testing and offline environments. Retains traces and lifecycle events in memory for fast assertion and metrics extraction.

```typescript
import { InMemoryRunRecorder } from "./src/observability";

const recorder = new InMemoryRunRecorder();
const investigator = new AutonomousInvestigator({ recorder });
// Traces accessible via recorder.getTraces()
```

### 2. `LocalJsonRunRecorder`
Extends `InMemoryRunRecorder` and persists structured JSON trace files to `.logs/investigations/${trace.runId}.json`. Automatically redacts credentials and API keys matching Google (`AIza...`), Neatlogs (`nl_...`), and Bearer authorization tokens.

```typescript
import { LocalJsonRunRecorder } from "./src/observability";

const recorder = new LocalJsonRunRecorder({ logDir: "./.logs/investigations" });
```

### 3. `NeatlogsRunRecorder`
Cloud-native tracing recorder integrating directly with Neatlogs.
- Automatically reads `NEATLOGS_API_KEY` from environment or `.env` via `loadLocalEnv()`.
- Maps ClosePilot's canonical trace into Neatlogs nested span hierarchy:
  - `kind: "TOOL"`: Tool executions (`get_case`, `get_evidence`, `get_ledger_entry`, `get_related_transactions`, `get_case_history`)
  - `kind: "GUARDRAIL"`: Safety policy evaluations (`EVIDENCE_CITATION_INTEGRITY`, `AUTO_RESOLVE_GUARD`, `UNMATCHED_TRANSACTION_GUARD`, `MISSING_DOCUMENTATION_GUARD`, `TIMING_DIFFERENCE_GUARD`)
  - `kind: "LLM"`: Model provider recommendation, confidence, and reasoning
- Provides **graceful offline fallback**: if `NEATLOGS_API_KEY` is not present, it logs locally and safely without network calls or exceptions.
- Implements resilient network timeouts via `AbortController` (default 5000ms).

```typescript
import { NeatlogsRunRecorder } from "./src/observability";

const recorder = new NeatlogsRunRecorder({
  workflowName: "month-end-closepilot",
  project: "ClosePilot",
});
```

---

## 5. End-to-End Workflow & Review Queue Integration

When running `runEndToEndReconciliationWorkflow(options)`:
- Pass `recorder?: InvestigationRunRecorder` in `EndToEndWorkflowOptions`.
- The workflow defaults to `new InMemoryRunRecorder()` if none is supplied.
- Returns `traces: ReadonlyArray<InvestigationRunTrace>` and `observabilityMetrics?: ObservabilityMetrics` directly in `EndToEndWorkflowResult`.
- The human reviewer can inspect the exact tool queries, policy validations, and model confidence that led to the agent's recommendation.

```typescript
const result = await runEndToEndReconciliationWorkflow({
  recorder: new LocalJsonRunRecorder(),
});

console.log("Total runs:", result.observabilityMetrics?.totalRuns);
console.log("Average duration (ms):", result.observabilityMetrics?.averageDurationMs);
console.log("Policy blocks:", result.observabilityMetrics?.policyBlocksCount);
```

---

## 6. Verification and Test Coverage

The test suite in `tests/unit/observability.test.ts` validates:
1. **Pure Metrics**: Correct calculation of runs, durations, tool calls, policy blocks, and human review escalations.
2. **Lifecycle Trace**: Sequential event generation for standard investigations (`investigation_started` -> `tool_called` -> `tool_completed` -> `policy_evaluated` -> `recommendation_generated` -> `investigation_completed`).
3. **Auto-Resolution Guard**: Traces for skipped auto-resolved cases emit `investigation_skipped` with `requiresHumanReview: false`.
4. **Policy Violation Auditing**: Policy rejections record `outcome: "FAILED_POLICY_CHECK"`, sanitize recommendations to `ESCALATE_TO_MANAGEMENT`, and preserve the raw model recommendation.
5. **Execution Failures**: Provider crashes record `outcome: "FAILED_EXECUTION"` with error stack and `investigation_failed` event.
6. **Failure Safety**: Recorder exceptions never interrupt the deterministic financial pipeline.
7. **Local Redaction**: File emission scrubs all API keys and bearer tokens.
8. **Neatlogs Integration**: Correct payload formation (TOOL, GUARDRAIL, LLM spans), auth headers, and timeout absorption.
