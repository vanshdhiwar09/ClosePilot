// src/observability/recorder.ts
// Pluggable run recorder architecture for ClosePilot Autonomous Investigation:
// Supports InMemoryRunRecorder (testing), LocalJsonRunRecorder (local filesystem), and NeatlogsRunRecorder.

import * as fs from "fs";
import * as path from "path";
import {
  InvestigationLifecycleEvent,
  InvestigationRunTrace,
  ObservabilityMetrics,
} from "./types";
import { calculateObservabilityMetrics } from "./metrics";
import { loadLocalEnv } from "./env";

export interface InvestigationRunRecorder {
  readonly name: string;
  recordEvent(event: InvestigationLifecycleEvent): Promise<void> | void;
  recordTrace(trace: InvestigationRunTrace): Promise<void> | void;
  getTraces(): ReadonlyArray<InvestigationRunTrace>;
  getTrace(runId: string): InvestigationRunTrace | undefined;
  getMetrics(): ObservabilityMetrics;
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}

// ==========================================
// In-Memory Recorder (Default for Tests & Local)
// ==========================================

export class InMemoryRunRecorder implements InvestigationRunRecorder {
  public readonly name: string = "in_memory_run_recorder";
  protected readonly traces: InvestigationRunTrace[] = [];
  protected readonly events: InvestigationLifecycleEvent[] = [];

  public recordEvent(event: InvestigationLifecycleEvent): void {
    this.events.push({ ...event });
  }

  public recordTrace(trace: InvestigationRunTrace): void {
    this.traces.push({ ...trace });
  }

  public getTraces(): ReadonlyArray<InvestigationRunTrace> {
    return [...this.traces];
  }

  public getTrace(runId: string): InvestigationRunTrace | undefined {
    return this.traces.find((t) => t.runId === runId);
  }

  public getEvents(runId?: string): ReadonlyArray<InvestigationLifecycleEvent> {
    if (runId) {
      return this.events.filter((e) => e.runId === runId);
    }
    return [...this.events];
  }

  public getMetrics(): ObservabilityMetrics {
    return calculateObservabilityMetrics(this.traces);
  }

  public clear(): void {
    this.traces.length = 0;
    this.events.length = 0;
  }
}

// ==========================================
// Local JSON File Recorder
// ==========================================

export class LocalJsonRunRecorder extends InMemoryRunRecorder {
  public override readonly name = "local_json_run_recorder";
  private readonly logDir: string;

  constructor(options?: { logDir?: string }) {
    super();
    const isNode =
      typeof window === "undefined" &&
      typeof process !== "undefined" &&
      typeof process.cwd === "function";
    const cwd = isNode ? process.cwd() : "";
    this.logDir =
      options?.logDir ||
      (isNode && cwd ? path.resolve(cwd, ".logs", "investigations") : "");
    try {
      if (isNode && this.logDir && !fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch {
      // Non-fatal if directory creation fails
    }
  }

  public override recordTrace(trace: InvestigationRunTrace): void {
    super.recordTrace(trace);
    try {
      if (!this.logDir || !fs?.writeFileSync || !path?.join) return;
      const sanitized = this.sanitizeTrace(trace);
      const filePath = path.join(this.logDir, `${trace.runId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), "utf-8");
    } catch (err) {
      // Never break financial reconciliation on logging failure
    }
  }

  private sanitizeTrace(trace: InvestigationRunTrace): Record<string, unknown> {
    const serialized = JSON.stringify(trace);
    // Redact common secret patterns if present
    const redacted = serialized
      .replace(/AIza[0-9A-Za-z-_]{30,45}/g, "[REDACTED_API_KEY]")
      .replace(/nl_[0-9A-Za-z-_]{10,}/g, "[REDACTED_NEATLOGS_KEY]")
      .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, "Bearer [REDACTED]");
    return JSON.parse(redacted);
  }
}

// ==========================================
// Neatlogs Run Recorder (Live Cloud Telemetry)
// ==========================================

export type NeatlogsConfig = {
  apiKey?: string;
  workflowName?: string;
  project?: string;
  endpoint?: string;
  timeoutMs?: number;
};

export class NeatlogsRunRecorder extends InMemoryRunRecorder {
  public override readonly name = "neatlogs_run_recorder";
  private readonly apiKey: string;
  private readonly workflowName: string;
  private readonly project: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(config?: NeatlogsConfig) {
    super();
    loadLocalEnv();
    const hasExplicitKey = config?.apiKey !== undefined;
    const envApiKey =
      typeof process !== "undefined" && process.env
        ? process.env.NEATLOGS_API_KEY || process.env.NEATLOGS_KEY || ""
        : "";
    this.apiKey = hasExplicitKey ? (config?.apiKey || "") : envApiKey;
    this.workflowName = config?.workflowName || "closepilot-investigation";
    this.project = config?.project || "ClosePilot";
    const isBrowser = typeof window !== "undefined";
    this.endpoint =
      config?.endpoint || (isBrowser ? "/api/trace" : "https://ingest.neatlogs.com/v1/trace");
    this.timeoutMs = config?.timeoutMs || 5000;
  }

  public override async recordTrace(trace: InvestigationRunTrace): Promise<void> {
    super.recordTrace(trace);

    // Save locally as reliable filesystem fallback if running in Node.js
    if (typeof window === "undefined" && typeof process !== "undefined" && typeof process.cwd === "function") {
      try {
        const cwd = process.cwd();
        if (cwd && fs?.writeFileSync && path?.join) {
          const logDir = path.resolve(cwd, ".logs", "investigations");
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          const filePath = path.join(logDir, `${trace.runId}.json`);
          fs.writeFileSync(filePath, JSON.stringify(trace, null, 2), "utf-8");
        }
      } catch {
        // Non-fatal filesystem logging
      }
    }

    const isBrowser = typeof window !== "undefined";
    if (!this.apiKey && !isBrowser && !this.endpoint.startsWith("/")) {
      // Graceful offline fallback: retained in-memory and local disk without throwing
      return;
    }

    try {
      const payload = this.buildNeatlogsPayload(trace);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
    } catch {
      // Non-fatal: Network or API failure to Neatlogs must NEVER break financial reconciliation
    }
  }

  /**
   * Converts canonical ClosePilot InvestigationRunTrace into Neatlogs nested trace schema.
   */
  private buildNeatlogsPayload(trace: InvestigationRunTrace): Record<string, unknown> {
    const children: Array<Record<string, unknown>> = [];

    // 1. Tool spans
    for (const tc of trace.toolCalls) {
      children.push({
        name: `tool:${tc.toolName}`,
        kind: "TOOL",
        durationMs: tc.durationMs,
        input: tc.input,
        output: tc.output,
        timestamp: tc.timestamp,
      });
    }

    // 2. Guardrail / Policy spans
    for (const pe of trace.policyEvaluations) {
      children.push({
        name: `policy:${pe.policyRule}`,
        kind: "GUARDRAIL",
        status: pe.isPermitted ? "PASSED" : "BLOCKED",
        reason: pe.policyReason,
        forcedHumanReview: pe.forcedHumanReview,
        timestamp: pe.timestamp,
        context: pe.context,
      });
    }

    // 3. Model Recommendation span
    const modelName =
      (trace.metadata?.model as string) ||
      (trace.provider.startsWith("gemini_rest_provider_")
        ? trace.provider.replace("gemini_rest_provider_", "")
        : trace.provider);

    const usage = (trace.metadata?.usage || trace.metadata?.tokens) as
      | { prompt?: number; completion?: number; total?: number }
      | undefined;

    children.push({
      name: `model:${trace.provider}`,
      kind: "LLM",
      provider: trace.provider,
      model: modelName,
      outcome: trace.outcome,
      recommendation: trace.recommendation.action,
      suggestedReason: trace.recommendation.suggestedReason,
      confidence: trace.confidence,
      riskLevel: trace.riskLevel,
      rawModelAction: trace.rawModelRecommendation?.action,
      evidenceIdsCited: trace.evidenceIds,
      durationMs: trace.durationMs,
      tokens: usage,
    });

    return {
      name: `${this.workflowName}:${trace.caseId}`,
      project: this.project,
      traceId: trace.runId,
      caseId: trace.caseId,
      bankTransactionId: trace.bankTransactionId,
      provider: trace.provider,
      model: modelName,
      tokens: usage,
      startTime: trace.startTime,
      endTime: trace.endTime,
      durationMs: trace.durationMs,
      outcome: trace.outcome,
      children,
      metadata: {
        ...trace.metadata,
        provider: trace.provider,
        model: modelName,
        requiresHumanReview: trace.requiresHumanReview,
        error: trace.error?.message,
      },
    };
  }
}
