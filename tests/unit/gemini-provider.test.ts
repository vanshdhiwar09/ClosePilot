// tests/unit/gemini-provider.test.ts
// Tests for Model Provider Abstraction and Gemini Adapter boundary

import { describe, it, expect } from "vitest";
import {
  createInvestigationModelProvider,
  GeminiModelProvider,
} from "../../src/agent/gemini-provider";
import { DeterministicMockProvider } from "../../src/agent/provider";

describe("Phase 5B Model Provider Abstraction", () => {
  it("defaults to DeterministicMockProvider when GEMINI_API_KEY is not set", () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const provider = createInvestigationModelProvider();
      expect(provider).toBeInstanceOf(DeterministicMockProvider);
      expect(provider.name).toBe("deterministic_accounting_model_v1");
    } finally {
      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  it("instantiates GeminiModelProvider when explicit key or env key is provided", () => {
    const provider = new GeminiModelProvider({
      apiKey: "test_dummy_key",
      model: "gemini-1.5-flash",
    });

    expect(provider.name).toBe("gemini_rest_provider_gemini-1.5-flash");
  });

  it("throws clear error when GeminiModelProvider is invoked with empty key", async () => {
    const provider = new GeminiModelProvider({ apiKey: "" });
    await expect(provider.analyzeCase({} as any)).rejects.toThrow(
      "GeminiModelProvider requires GEMINI_API_KEY"
    );
  });
});
