// src/agent/gemini-provider.ts
// Optional Google Gemini API provider adapter for ClosePilot Autonomous Investigation Agent.
// Zero-dependency REST implementation using native fetch.
// Graceful offline fallback: defaults to DeterministicMockProvider unless explicitly configured with an API key.

import {
  InvestigationModelProvider,
  ModelAnalysisResponse,
  ModelPrompt,
  DeterministicMockProvider,
} from "./provider";
import {
  RecommendationAction,
  RiskLevel,
  InvestigationConfidence,
} from "./types";

export type GeminiProviderConfig = {
  apiKey?: string;
  model?: string; // default: "gemini-2.5-flash"
  timeoutMs?: number;
};

export class GeminiModelProvider implements InvestigationModelProvider {
  public readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config?: GeminiProviderConfig) {
    this.apiKey =
      config?.apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";
    this.model = config?.model || process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
    this.timeoutMs = config?.timeoutMs || 30_000;
    this.name = `gemini_rest_provider_${this.model}`;
  }

  public async analyzeCase(prompt: ModelPrompt): Promise<ModelAnalysisResponse> {
    if (!this.apiKey) {
      throw new Error(
        "GeminiModelProvider requires GEMINI_API_KEY or GOOGLE_API_KEY environment variable. " +
          "For offline or automated testing environments, use DeterministicMockProvider."
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const instructions = `
You are ClosePilot's autonomous accounting investigation agent.
Analyze the following month-end reconciliation exception and return a valid JSON object with:
- "summary": concise explanation of the discrepancy
- "rootCause": root cause of the exception
- "reasoning": array of string reasoning steps
- "recommendedAction": one of ["APPROVE_MATCH", "REJECT_MATCH", "REQUEST_EVIDENCE", "MANUAL_ENTRY_REQUIRED", "PRICE_ADJUSTMENT_REQUIRED", "ESCALATE_TO_MANAGEMENT", "NO_ACTION_REQUIRED"]
- "targetLedgerEntryId": optional string ID of candidate entry
- "suggestedReason": actionable rationale for reviewer
- "requiredEvidenceTypes": optional array of strings (e.g. ["invoice", "receipt"])
- "confidence": one of ["HIGH", "MEDIUM", "LOW"]
- "riskLevel": one of ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
- "citedEvidenceIds": array of evidence IDs cited from the context
Respond ONLY with raw JSON matching this schema.
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: instructions },
                { text: `Case Detail:\n${JSON.stringify(prompt.caseDetail, null, 2)}` },
                { text: `Observations:\n${JSON.stringify(prompt.investigationObservations, null, 2)}` },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (HTTP ${response.status}): ${errorText}`);
      }

      const json: any = await response.json();
      const contentText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!contentText) {
        throw new Error("Gemini API returned empty response candidates.");
      }

      const parsed = JSON.parse(contentText);

      return {
        summary: parsed.summary || "Case analyzed by Gemini model.",
        rootCause: parsed.rootCause || "Root cause identified by model.",
        reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : ["Reasoned by model."],
        recommendedAction: (parsed.recommendedAction as RecommendationAction) || "ESCALATE_TO_MANAGEMENT",
        targetLedgerEntryId: parsed.targetLedgerEntryId,
        suggestedReason: parsed.suggestedReason || "Action suggested by model.",
        requiredEvidenceTypes: parsed.requiredEvidenceTypes,
        confidence: (parsed.confidence as InvestigationConfidence) || "MEDIUM",
        riskLevel: (parsed.riskLevel as RiskLevel) || "MEDIUM",
        citedEvidenceIds: Array.isArray(parsed.citedEvidenceIds) ? parsed.citedEvidenceIds : [],
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Provider factory: returns GeminiModelProvider when live LLM is requested and configured,
 * otherwise defaults safely to the DeterministicMockProvider.
 */
export function createInvestigationModelProvider(options?: {
  useLiveLLM?: boolean;
  apiKey?: string;
  model?: string;
}): InvestigationModelProvider {
  const shouldUseLive =
    options?.useLiveLLM ??
    (process.env.CLOSEPILOT_USE_LIVE_LLM === "true" &&
      Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY));

  if (shouldUseLive) {
    return new GeminiModelProvider({
      apiKey: options?.apiKey,
      model: options?.model,
    });
  }

  return new DeterministicMockProvider();
}
