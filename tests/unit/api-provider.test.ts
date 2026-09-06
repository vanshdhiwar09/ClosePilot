// tests/unit/api-provider.test.ts
// Unit tests for ApiInvestigationModelProvider and server-side handleInvestigateRequest boundary.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiInvestigationModelProvider } from "../../src/agent/api-provider";
import { handleInvestigateRequest } from "../../src/server/investigate-handler";
import { DeterministicMockProvider, ModelPrompt } from "../../src/agent/provider";

const samplePrompt: ModelPrompt = {
  caseDetail: {
    caseId: "EC001",
    bankTransaction: {
      id: "BT001",
      transactionDate: "2024-01-15",
      amount: "1200.00",
      currency: "USD",
      description: "Vendor Payment Acme",
      counterparty: "Acme Corp",
      reference: "INV-101",
      accountId: "AcctDemo",
      direction: "credit",
      source: "synthetic_bank",
      sourceRecordId: "SR-001",
      postedAt: "2024-01-15T10:00:00Z",
      schemaVersion: "1",
    },
    candidateLedgerEntries: [],
    reconciliationResult: {
      id: "REC-001",
      bankTransactionId: "BT001",
      matchedLedgerEntryIds: [],
      confidence: "high",
      createdAt: "2024-01-15T10:00:00Z",
      status: "review_required",
      matchMethod: "exact_match",
      candidateLedgerEntryIds: [],
    } as any,
    exceptions: [],
    evidence: [],
    autoResolutionAllowed: false,
  } as any,
  investigationObservations: {
    tool: "inspect_transaction",
    summary: "Transaction inspected",
  },
  systemPrompt: "System prompt instructions",
  userPrompt: "Analyze case EC001",
};

describe("ApiInvestigationModelProvider & Server Handler Boundary", () => {
  const originalFetch = global.fetch;

  let originalEnvBase: string | undefined;

  beforeEach(() => {
    originalEnvBase = process.env.CLOSEPILOT_API_BASE_URL;
    process.env.CLOSEPILOT_API_BASE_URL = "http://localhost:5173";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnvBase !== undefined) {
      process.env.CLOSEPILOT_API_BASE_URL = originalEnvBase;
    } else {
      delete process.env.CLOSEPILOT_API_BASE_URL;
    }
    vi.restoreAllMocks();
  });

  describe("A & B: Client ApiInvestigationModelProvider Request & Response Handling", () => {
    it("A: sends the correct POST request shape to /api/investigate", async () => {
      let capturedUrl = "";
      let capturedMethod = "";
      let capturedBody: any;

      global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init.method || "";
        capturedBody = JSON.parse(init.body as string);
        return {
          ok: true,
          json: async () => ({
            summary: "AI analyzed summary",
            rootCause: "AI analyzed root cause",
            reasoning: ["AI step 1"],
            recommendedAction: "APPROVE_MATCH",
            confidence: "HIGH",
            riskLevel: "LOW",
            citedEvidenceIds: [],
          }),
        };
      });

      const provider = new ApiInvestigationModelProvider();
      await provider.analyzeCase(samplePrompt);

      expect(capturedUrl).toContain("/api/investigate");
      expect(capturedMethod).toBe("POST");
      expect(capturedBody.investigationObservations).toBeDefined();
      expect(capturedBody.investigationObservations.tool).toBe("inspect_transaction");
    });

    it("B: transforms successful API response into ModelAnalysisResponse", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          summary: "AI analyzed summary",
          rootCause: "AI analyzed root cause",
          reasoning: ["Reason 1", "Reason 2"],
          recommendedAction: "APPROVE_MATCH",
          targetLedgerEntryId: "LE001",
          suggestedReason: "Approved by AI",
          confidence: "HIGH",
          riskLevel: "LOW",
          citedEvidenceIds: ["EVD-1"],
        }),
      });

      const provider = new ApiInvestigationModelProvider();
      const result = await provider.analyzeCase(samplePrompt);

      expect(result.summary).toBe("AI analyzed summary");
      expect(result.rootCause).toBe("AI analyzed root cause");
      expect(result.recommendedAction).toBe("APPROVE_MATCH");
      expect(result.targetLedgerEntryId).toBe("LE001");
      expect(result.confidence).toBe("HIGH");
      expect(result.citedEvidenceIds).toEqual(["EVD-1"]);
    });
  });

  describe("C: Fallback Behavior on API Failure", () => {
    it("C1: falls back to DeterministicMockProvider when API returns HTTP 500 error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal error" }),
      });

      const provider = new ApiInvestigationModelProvider();
      const result = await provider.analyzeCase(samplePrompt);

      // DeterministicMockProvider produced an output instead of throwing
      expect(result).toBeDefined();
      expect(result.recommendedAction).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it("C2: falls back to DeterministicMockProvider on network timeout / failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

      const provider = new ApiInvestigationModelProvider();
      const result = await provider.analyzeCase(samplePrompt);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it("C3: falls back to DeterministicMockProvider when server indicates fallback (no key)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fallback: true, reason: "No API key configured" }),
      });

      const provider = new ApiInvestigationModelProvider();
      const result = await provider.analyzeCase(samplePrompt);

      expect(result).toBeDefined();
      expect(result.recommendedAction).toBeDefined();
    });
  });

  describe("D: Client Bundle & Source Security", () => {
    it("D1: ApiInvestigationModelProvider source code does not contain secret API key variables", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const clientProviderPath = path.resolve(__dirname, "../../src/agent/api-provider.ts");
      const content = fs.readFileSync(clientProviderPath, "utf-8");

      expect(content).not.toContain("GEMINI_API_KEY");
      expect(content).not.toContain("GOOGLE_API_KEY");
      expect(content).not.toContain("VITE_GEMINI");
    });
  });

  describe("E & F: Server Handler Validation & Security", () => {
    it("E1: server rejects malformed payload with HTTP 400", async () => {
      const result = await handleInvestigateRequest("not an object", {});
      expect(result.status).toBe(400);
      expect(result.data.error).toContain("Invalid request payload");
    });

    it("E2: server rejects payload missing caseDetail with HTTP 400", async () => {
      const result = await handleInvestigateRequest({}, {});
      expect(result.status).toBe(400);
      expect(result.data.error).toContain("Missing caseDetail");
    });

    it("F1: server gracefully returns fallback when GEMINI_API_KEY is not in env", async () => {
      const result = await handleInvestigateRequest(samplePrompt, {});
      expect(result.status).toBe(200);
      expect(result.data.fallback).toBe(true);
      expect((result.data as any).reason).toContain("GEMINI_API_KEY is not configured");
      expect(JSON.stringify(result.data)).not.toContain("AIza");
    });

    it("F2: server sanitizes and never exposes secret keys in error messages", async () => {
      const fakeSecretKey = "dummy-test-secret-key-12345-abcdef";
      const envWithKey = { GEMINI_API_KEY: fakeSecretKey };

      // Mock fetch in GeminiModelProvider to fail with an error containing the key in query param
      global.fetch = vi.fn().mockRejectedValue(
        new Error(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${fakeSecretKey} failed with 500`)
      );

      const result = await handleInvestigateRequest(samplePrompt, envWithKey);

      expect(result.status).toBe(502);
      const jsonStr = JSON.stringify(result.data);
      expect(jsonStr).not.toContain(fakeSecretKey);
      expect(jsonStr).toContain("[REDACTED");
    });

    it("F3: safely handles null targetLedgerEntryId and requiredEvidenceTypes in model responses without schema crash", async () => {
      const { agentRecommendationSchema } = await import("../../src/agent/types");
      const parsed = agentRecommendationSchema.parse({
        action: "ESCALATE_TO_MANAGEMENT",
        targetLedgerEntryId: null,
        suggestedReason: "No matching candidate entry found.",
        requiredEvidenceTypes: null,
      });

      expect(parsed.targetLedgerEntryId).toBeUndefined();
      expect(parsed.requiredEvidenceTypes).toBeUndefined();
      expect(parsed.action).toBe("ESCALATE_TO_MANAGEMENT");
    });
  });
});
