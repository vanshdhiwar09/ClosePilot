// src/agent/api-provider.ts
// Frontend client-side model provider adapter for ClosePilot.
// Proxies case analysis prompts through the secure server-side `/api/investigate` boundary.
// Never holds, accesses, or exposes secret model credentials on the client.
// Falls back gracefully to DeterministicMockProvider if offline or API endpoint is unavailable.

import {
  InvestigationModelProvider,
  ModelAnalysisResponse,
  ModelPrompt,
  DeterministicMockProvider,
} from "./provider";

export class ApiInvestigationModelProvider implements InvestigationModelProvider {
  public readonly name: string = "api_proxy_investigation_provider";
  private readonly fallbackProvider: DeterministicMockProvider;
  private readonly timeoutMs: number;

  constructor(options?: { timeoutMs?: number; fallbackProvider?: DeterministicMockProvider }) {
    this.timeoutMs = options?.timeoutMs || 25_000;
    this.fallbackProvider = options?.fallbackProvider || new DeterministicMockProvider();
  }

  public async analyzeCase(prompt: ModelPrompt): Promise<ModelAnalysisResponse> {
    let endpoint = "/api/investigate";
    if (typeof window !== "undefined") {
      endpoint = "/api/investigate";
    } else if (process.env.CLOSEPILOT_API_BASE_URL) {
      endpoint = `${process.env.CLOSEPILOT_API_BASE_URL}/api/investigate`;
    } else {
      // In headless Node test runs without a mock server or base URL, use deterministic fallback
      return this.fallbackProvider.analyzeCase(prompt);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prompt),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        console.warn(
          `[ApiInvestigationModelProvider] Server responded with HTTP ${response.status}: ${errJson.error || "Unknown error"}. Falling back to deterministic provider.`
        );
        return this.fallbackProvider.analyzeCase(prompt);
      }

      const data = await response.json();

      if (data.fallback || data.error) {
        console.warn(
          `[ApiInvestigationModelProvider] Server indicated fallback: ${data.reason || data.error || "No API key"}. Using deterministic provider.`
        );
        return this.fallbackProvider.analyzeCase(prompt);
      }

      return data as ModelAnalysisResponse;
    } catch (err: any) {
      console.warn(
        `[ApiInvestigationModelProvider] Network or timeout error reaching /api/investigate: ${err.message}. Falling back to deterministic provider.`
      );
      return this.fallbackProvider.analyzeCase(prompt);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
