// tests/unit/observability.test.ts
// Comprehensive unit test suite for ClosePilot Phase 6: Observability, Run Logging & Neatlogs Integration.

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect, afterEach } from "vitest";
import {
  InMemoryRunRecorder,
  LocalJsonRunRecorder,
  NeatlogsRunRecorder,
  calculateObservabilityMetrics,
  InvestigationRunTrace,
  investigationRunTraceSchema,
} from "../../src/observability";
import { AutonomousInvestigator } from "../../src/agent/investigator";
import { ReadOnlyInvestigationToolbox, InvestigationContext } from "../../src/agent/tools";
import { InvestigationModelProvider } from "../../src/agent/provider";
import { runEndToEndReconciliationWorkflow } from "../../src/workflow/reconciliation-workflow";
import { loadFixture, loadGroundTruth } from "../../src/schemas/fixture-loader";
import {
  initializePipelineContext,
  reconcileBankTransaction,
} from "../../src/reconciliation/pipeline";

describe("Phase 6 Observability & Run Logging", () => {
  const fixture = loadFixture("month-end-reconciliation-2024.1") as any;
  const groundTruth = loadGroundTruth("2024.1") as any;

  function createTestContext(): InvestigationContext {
    const bankTransactions = fixture.bankTransactions;
    const ledgerEntries = fixture.ledgerEntries;
    const documents = fixture.documents;
    const pipelineCtx = initializePipelineContext(bankTransactions, ledgerEntries);

    const reconcileOutputs = new Map();
    const caseBankTxMap = new Map();

    for (const ec of groundTruth.evaluationCases) {
      const bankTx = bankTransactions.find((b: any) => b.id === ec.bankTransactionId);
      if (bankTx) {
        const out = reconcileBankTransaction(bankTx, ledgerEntries, documents, pipelineCtx);
        reconcileOutputs.set(bankTx.id, out);
        caseBankTxMap.set(ec.id, bankTx.id);
      }
    }

    return {
      bankTransactions,
      ledgerEntries,
      documents,
      reconcileOutputs,
      caseBankTxMap,
    };
  }

  describe("1. Pure Observability Metrics Calculation", () => {
    it("calculates accurate summary metrics for a collection of traces", () => {
      const traces: InvestigationRunTrace[] = [
        {
          runId: "RUN-1",
          caseId: "C1",
          bankTransactionId: "BT1",
          startTime: "2026-09-06T10:00:00.000Z",
          endTime: "2026-09-06T10:00:01.000Z",
          durationMs: 100,
          provider: "mock_gemini",
          outcome: "COMPLETED",
          recommendation: { action: "APPROVE_MATCH", suggestedReason: "Matched accurately" },
          confidence: "HIGH",
          riskLevel: "LOW",
          requiresHumanReview: true,
          toolCalls: [{ toolName: "get_case", input: {}, output: {}, durationMs: 10, timestamp: "" }],
          policyEvaluations: [
            {
              policyRule: "MATCH_CONFIRMATION_CHECK",
              isPermitted: true,
              policyReason: "OK",
              forcedHumanReview: false,
              timestamp: "",
            },
          ],
          evidenceIds: ["EV1"],
          events: [],
          metadata: {},
        },
        {
          runId: "RUN-2",
          caseId: "C2",
          bankTransactionId: "BT2",
          startTime: "2026-09-06T10:00:02.000Z",
          endTime: "2026-09-06T10:00:03.000Z",
          durationMs: 200,
          provider: "mock_gemini",
          outcome: "FAILED_POLICY_CHECK",
          recommendation: { action: "ESCALATE_TO_MANAGEMENT", suggestedReason: "Forced escalation" },
          rawModelRecommendation: { action: "APPROVE_MATCH", suggestedReason: "Unsafe approve" },
          confidence: "MEDIUM",
          riskLevel: "HIGH",
          requiresHumanReview: true,
          toolCalls: [],
          policyEvaluations: [
            {
              policyRule: "UNMATCHED_TX_APPROVE_BLOCK",
              isPermitted: false,
              policyReason: "Blocked unmatched approval",
              forcedHumanReview: true,
              timestamp: "",
            },
          ],
          evidenceIds: [],
          events: [],
          metadata: {},
        },
        {
          runId: "RUN-3",
          caseId: "C3",
          bankTransactionId: "BT3",
          startTime: "2026-09-06T10:00:04.000Z",
          endTime: "2026-09-06T10:00:04.050Z",
          durationMs: 50,
          provider: "mock_gemini",
          outcome: "SKIPPED_AUTO_RESOLVED",
          recommendation: { action: "NO_ACTION_REQUIRED", suggestedReason: "Auto-reconciled" },
          confidence: "HIGH",
          riskLevel: "LOW",
          requiresHumanReview: false,
          toolCalls: [],
          policyEvaluations: [],
          evidenceIds: [],
          events: [],
          metadata: {},
        },
      ];

      const metrics = calculateObservabilityMetrics(traces);

      expect(metrics.totalRuns).toBe(3);
      expect(metrics.completedRuns).toBe(1);
      expect(metrics.policyBlocksCount).toBe(1);
      expect(metrics.skippedRuns).toBe(1);
      expect(metrics.failedRuns).toBe(1);
      expect(metrics.averageDurationMs).toBe(116.7);
      expect(metrics.averageToolCalls).toBe(0.3);
      expect(metrics.policyEvaluationsCount).toBe(2);
      expect(metrics.policyBlocksCount).toBe(1);
      expect(metrics.forcedHumanReviewCount).toBe(1);
    });

    it("handles empty traces list gracefully", () => {
      const metrics = calculateObservabilityMetrics([]);
      expect(metrics.totalRuns).toBe(0);
      expect(metrics.averageDurationMs).toBe(0);
      expect(metrics.averageToolCalls).toBe(0);
    });
  });

  describe("2. Lifecycle Event & Full Trace Emission in Investigation", () => {
    it("captures full trace with sequential lifecycle events for standard investigation", async () => {
      const recorder = new InMemoryRunRecorder();
      const investigator = new AutonomousInvestigator({ recorder });
      const context = createTestContext();
      const toolbox = new ReadOnlyInvestigationToolbox(context);

      // Investigate EC004 (timing difference)
      const result = await investigator.investigateCase("EC004", toolbox);

      expect(result.outcome).toBe("COMPLETED");

      const traces = recorder.getTraces();
      expect(traces.length).toBe(1);

      const trace = traces[0];
      // Verify schema conformity
      expect(() => investigationRunTraceSchema.parse(trace)).not.toThrow();

      expect(trace.caseId).toBe("EC004");
      expect(trace.bankTransactionId).toBe("BT004");
      expect(trace.outcome).toBe("COMPLETED");
      expect(trace.durationMs).toBeGreaterThan(0);
      expect(trace.toolCalls.length).toBeGreaterThan(0);
      expect(trace.policyEvaluations.length).toBeGreaterThanOrEqual(1);

      // Verify lifecycle event sequence
      const eventTypes = trace.events.map((e) => e.eventType);
      expect(eventTypes[0]).toBe("investigation_started");
      expect(eventTypes).toContain("tool_called");
      expect(eventTypes).toContain("tool_completed");
      expect(eventTypes).toContain("policy_evaluated");
      expect(eventTypes).toContain("recommendation_generated");
      expect(eventTypes[eventTypes.length - 1]).toBe("investigation_completed");
    });

    it("captures skipped trace when investigating auto-resolved case", async () => {
      const recorder = new InMemoryRunRecorder();
      const investigator = new AutonomousInvestigator({ recorder });
      const context = createTestContext();
      const toolbox = new ReadOnlyInvestigationToolbox(context);

      // EC001 is auto-resolved exact match
      const result = await investigator.investigateCase("EC001", toolbox);

      expect(result.outcome).toBe("SKIPPED_AUTO_RESOLVED");

      const traces = recorder.getTraces();
      expect(traces.length).toBe(1);
      const trace = traces[0];

      expect(trace.outcome).toBe("SKIPPED_AUTO_RESOLVED");
      expect(trace.requiresHumanReview).toBe(false);
      expect(trace.policyEvaluations.some((p) => p.policyRule === "AUTO_RESOLVE_GUARD")).toBe(true);

      const eventTypes = trace.events.map((e) => e.eventType);
      expect(eventTypes).toContain("investigation_started");
      expect(eventTypes).toContain("investigation_skipped");
    });
  });

  describe("3. Policy Violations and Execution Failures", () => {
    it("records policy violation and retains raw model recommendation", async () => {
      // Mock provider that recommends APPROVE_MATCH for an unmatched transaction
      const rogueProvider: InvestigationModelProvider = {
        name: "rogue_provider",
        analyzeCase: async () => ({
          summary: "I think we should approve this without matching entry.",
          rootCause: "Unknown",
          recommendedAction: "APPROVE_MATCH",
          suggestedReason: "Approve blindly despite no entry",
          confidence: "HIGH",
          riskLevel: "LOW",
          reasoning: ["Just match it blindly."],
          citedEvidenceIds: ["NONEXISTENT_EVIDENCE_ID_999"],
        }),
      };

      const recorder = new InMemoryRunRecorder();
      const investigator = new AutonomousInvestigator({
        provider: rogueProvider,
        recorder,
      });
      const context = createTestContext();
      const toolbox = new ReadOnlyInvestigationToolbox(context);

      // EC003 is unmatched transaction (no candidates)
      const result = await investigator.investigateCase("EC003", toolbox);

      expect(result.outcome).toBe("FAILED_POLICY_CHECK");
      expect(result.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");

      const trace = recorder.getTrace(result.investigationId);
      expect(trace).toBeDefined();
      expect(trace?.outcome).toBe("FAILED_POLICY_CHECK");
      expect(trace?.rawModelRecommendation?.action).toBe("APPROVE_MATCH");
      expect(trace?.recommendation.action).toBe("ESCALATE_TO_MANAGEMENT");

      const blockedPolicy = trace?.policyEvaluations.find((p) => !p.isPermitted);
      expect(blockedPolicy).toBeDefined();
      expect(blockedPolicy?.forcedHumanReview).toBe(true);
    });

    it("records execution failure trace when provider throws error", async () => {
      const brokenProvider: InvestigationModelProvider = {
        name: "broken_provider",
        analyzeCase: async () => {
          throw new Error("Provider quota exceeded or network timeout");
        },
      };

      const recorder = new InMemoryRunRecorder();
      const investigator = new AutonomousInvestigator({
        provider: brokenProvider,
        recorder,
      });
      const context = createTestContext();
      const toolbox = new ReadOnlyInvestigationToolbox(context);

      await expect(investigator.investigateCase("EC004", toolbox)).rejects.toThrow(
        "Provider quota exceeded or network timeout"
      );

      const traces = recorder.getTraces();
      expect(traces.length).toBe(1);
      const trace = traces[0];

      expect(trace.outcome).toBe("FAILED_EXECUTION");
      expect(trace.error?.message).toContain("quota exceeded");
      expect(trace.riskLevel).toBe("CRITICAL");
      expect(trace.requiresHumanReview).toBe(true);

      const failedEvent = trace.events.find((e) => e.eventType === "investigation_failed");
      expect(failedEvent).toBeDefined();
    });

    it("recorder failure does not break or alter financial investigation execution", async () => {
      // Faulty recorder that throws on recording
      const faultyRecorder = {
        name: "faulty_recorder",
        recordEvent: () => {
          throw new Error("Disk full or logger unreachable");
        },
        recordTrace: () => {
          throw new Error("Disk full or logger unreachable");
        },
        getTraces: () => [],
        getTrace: () => undefined,
        getMetrics: () => calculateObservabilityMetrics([]),
      };

      const investigator = new AutonomousInvestigator({
        recorder: faultyRecorder,
      });
      const context = createTestContext();
      const toolbox = new ReadOnlyInvestigationToolbox(context);

      // Investigation should still succeed normally without throwing
      const result = await investigator.investigateCase("EC004", toolbox);
      expect(result.outcome).toBe("COMPLETED");
      expect(result.recommendation).toBeDefined();
    });
  });

  describe("4. Local JSON File Recorder", () => {
    const testLogDir = path.resolve(process.cwd(), ".logs", "test-investigations");

    afterEach(() => {
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true, force: true });
      }
    });

    it("writes formatted trace to filesystem and redacts secret keys", () => {
      const fileRecorder = new LocalJsonRunRecorder({ logDir: testLogDir });

      const traceWithSecrets: InvestigationRunTrace = {
        runId: "RUN-SECRET-TEST",
        caseId: "CASE-SEC",
        bankTransactionId: "BT-SEC",
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMs: 120,
        provider: "mock_gemini",
        outcome: "COMPLETED",
        recommendation: {
          action: "APPROVE_MATCH",
          suggestedReason: "Tested with key AIzaSyA123456789012345678901234567890 and nl_test_key_secret_1234567890123456",
        },
        confidence: "HIGH",
        riskLevel: "LOW",
        requiresHumanReview: true,
        toolCalls: [],
        policyEvaluations: [],
        evidenceIds: [],
        events: [],
        metadata: {
          authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz",
        },
      };

      fileRecorder.recordTrace(traceWithSecrets);

      const writtenFile = path.join(testLogDir, "RUN-SECRET-TEST.json");
      expect(fs.existsSync(writtenFile)).toBe(true);

      const content = fs.readFileSync(writtenFile, "utf-8");
      expect(content).not.toContain("AIzaSyA123456789012345678901234567890");
      expect(content).toContain("[REDACTED_API_KEY]");
      expect(content).not.toContain("nl_test_key_secret_1234567890123456");
      expect(content).toContain("[REDACTED_NEATLOGS_KEY]");
      expect(content).toContain("Bearer [REDACTED]");
    });
  });

  describe("5. Neatlogs Run Recorder Integration", () => {
    it("operates in offline mode without throwing when no API key is provided", async () => {
      let fetchCalled = false;
      const originalFetch = global.fetch;
      global.fetch = (async () => {
        fetchCalled = true;
        return new Response();
      }) as any;

      try {
        const recorder = new NeatlogsRunRecorder({ apiKey: "" });

        const trace: InvestigationRunTrace = {
          runId: "RUN-NEAT-OFFLINE",
          caseId: "EC002",
          bankTransactionId: "BT002",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMs: 95,
          provider: "deterministic_accounting_model_v1",
          outcome: "COMPLETED",
          recommendation: { action: "APPROVE_MATCH", suggestedReason: "Offline test reason" },
          confidence: "HIGH",
          riskLevel: "LOW",
          requiresHumanReview: true,
          toolCalls: [],
          policyEvaluations: [],
          evidenceIds: [],
          events: [],
          metadata: {},
        };

        await expect(recorder.recordTrace(trace)).resolves.not.toThrow();
        expect(recorder.getTraces().length).toBe(1);
        expect(fetchCalled).toBe(false);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("sends structured trace with tool, guardrail, and llm spans when key is provided", async () => {
      const fetchCalls: Array<{ url: string; options: any }> = [];
      const originalFetch = global.fetch;

      // Mock fetch
      global.fetch = (async (url: any, options: any) => {
        fetchCalls.push({ url: url.toString(), options });
        return new Response(JSON.stringify({ ok: true, traceId: "neat-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as any;

      try {
        const recorder = new NeatlogsRunRecorder({
          apiKey: "nl_test_mock_api_key_123456789",
          endpoint: "https://ingest.neatlogs.com/v1/trace",
        });

        const trace: InvestigationRunTrace = {
          runId: "RUN-NEAT-TEST",
          caseId: "EC004",
          bankTransactionId: "BT004",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMs: 150,
          provider: "gemini_rest_provider_gemini-flash-lite-latest",
          outcome: "COMPLETED",
          recommendation: {
            action: "APPROVE_MATCH",
            suggestedReason: "Timing difference within 3 days",
          },
          confidence: "HIGH",
          riskLevel: "LOW",
          requiresHumanReview: true,
          toolCalls: [
            {
              toolName: "get_ledger_entry",
              input: { entryId: "LE004" },
              output: { found: true },
              durationMs: 25,
              timestamp: new Date().toISOString(),
            },
          ],
          policyEvaluations: [
            {
              policyRule: "TIMING_DIFF_RULE",
              isPermitted: true,
              policyReason: "Within 7 days",
              forcedHumanReview: false,
              timestamp: new Date().toISOString(),
            },
          ],
          evidenceIds: ["EV004"],
          events: [],
          metadata: {},
        };

        await recorder.recordTrace(trace);

        expect(fetchCalls.length).toBe(1);
        const call = fetchCalls[0];
        expect(call.url).toBe("https://ingest.neatlogs.com/v1/trace");
        expect(call.options.headers.Authorization).toBe("Bearer nl_test_mock_api_key_123456789");

        const body = JSON.parse(call.options.body);
        expect(body.traceId).toBe("RUN-NEAT-TEST");
        expect(body.project).toBe("ClosePilot");
        expect(body.children.length).toBe(3); // 1 tool + 1 policy + 1 llm model span

        const toolSpan = body.children.find((c: any) => c.kind === "TOOL");
        expect(toolSpan).toBeDefined();
        expect(toolSpan.name).toBe("tool:get_ledger_entry");

        const guardrailSpan = body.children.find((c: any) => c.kind === "GUARDRAIL");
        expect(guardrailSpan).toBeDefined();
        expect(guardrailSpan.status).toBe("PASSED");

        const llmSpan = body.children.find((c: any) => c.kind === "LLM");
        expect(llmSpan).toBeDefined();
        expect(llmSpan.recommendation).toBe("APPROVE_MATCH");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("absorbs remote fetch error safely without throwing", async () => {
      const originalFetch = global.fetch;
      global.fetch = (async () => {
        throw new Error("Network connection refused");
      }) as any;

      try {
        const recorder = new NeatlogsRunRecorder({
          apiKey: "nl_test_key",
          endpoint: "https://ingest.neatlogs.com/v1/trace",
        });

        const trace: InvestigationRunTrace = {
          runId: "RUN-ERR",
          caseId: "EC005",
          bankTransactionId: "BT005",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMs: 50,
          provider: "gemini_rest_provider_gemini-flash-lite-latest",
          outcome: "COMPLETED",
          recommendation: { action: "APPROVE_MATCH", suggestedReason: "Fetch error test reason" },
          confidence: "HIGH",
          riskLevel: "LOW",
          requiresHumanReview: true,
          toolCalls: [],
          policyEvaluations: [],
          evidenceIds: [],
          events: [],
          metadata: {},
        };

        await expect(recorder.recordTrace(trace)).resolves.not.toThrow();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("6. Workflow Integration & Observability Layer Separation", () => {
    it("populates run traces and metrics through runEndToEndReconciliationWorkflow", async () => {
      const recorder = new InMemoryRunRecorder();

      const res = await runEndToEndReconciliationWorkflow({
        recorder,
      });

      // Verification of deterministic financial pipeline integrity
      expect(res.summary.totalCases).toBe(8);
      expect(res.summary.autoResolvedCases).toBe(1);
      expect(res.summary.investigatedCases).toBe(7);

      // Verify traces collected
      expect(res.traces.length).toBe(7);
      expect(res.observabilityMetrics).toBeDefined();
      expect(res.observabilityMetrics?.totalRuns).toBe(7);
      expect(res.observabilityMetrics?.completedRuns).toBe(7);
      expect(res.observabilityMetrics?.averageToolCalls).toBeGreaterThan(0);
      expect(res.observabilityMetrics?.policyEvaluationsCount).toBeGreaterThan(0);

      // Verify each investigated case has a valid trace matching its review queue item
      for (const item of res.reviewQueue) {
        const matchTrace = res.traces.find((t) => t.caseId === item.caseId);
        expect(matchTrace).toBeDefined();
        expect(matchTrace?.bankTransactionId).toBe(item.bankTransactionId);
        expect(matchTrace?.runId).toBe(item.investigation?.investigationId);
      }
    });
  });
});
