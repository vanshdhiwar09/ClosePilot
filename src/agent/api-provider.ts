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
    } else if (typeof process !== "undefined" && process.env?.CLOSEPILOT_API_BASE_URL) {
      endpoint = `${process.env.CLOSEPILOT_API_BASE_URL}/api/investigate`;
    } else {
      // In headless Node test runs without a mock server or base URL, use deterministic fallback
      const fallbackRes = await this.fallbackProvider.analyzeCase(prompt);
      return { ...fallbackRes, _modelProvider: "deterministic_accounting_model_v1" };
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
        const reason = `HTTP ${response.status}: ${errJson.error || errJson.reason || "Server error"}`;
        console.warn(`[ApiInvestigationModelProvider] ${reason}. Falling back to deterministic provider.`);
        const fallbackRes = await this.fallbackProvider.analyzeCase(prompt);
        return { ...fallbackRes, _modelProvider: `fallback (${reason})` };
      }

      const data = await response.json();

      if (data.fallback || data.error) {
        const reason = data.reason || data.error || "No API key configured";
        console.warn(`[ApiInvestigationModelProvider] Server indicated fallback: ${reason}. Using deterministic provider.`);
        const fallbackRes = await this.fallbackProvider.analyzeCase(prompt);
        return { ...fallbackRes, _modelProvider: `fallback (${reason})` };
      }

      return data as ModelAnalysisResponse;
    } catch (err: any) {
      const reason = `Network error: ${err.message}`;
      console.warn(`[ApiInvestigationModelProvider] ${reason}. Falling back to deterministic provider.`);
      const fallbackRes = await this.fallbackProvider.analyzeCase(prompt);
      return { ...fallbackRes, _modelProvider: `fallback (${reason})` };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
