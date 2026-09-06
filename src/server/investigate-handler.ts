// src/server/investigate-handler.ts
// Server-side investigation request handler for ClosePilot.
// Executes in Node.js (Vite dev middleware or production serverless function).
// Holds and accesses GEMINI_API_KEY securely — never exposes secrets to the client.

import { GeminiModelProvider } from "../agent/gemini-provider";
import { ModelPrompt } from "../agent/provider";

export type InvestigateHandlerResult = {
  status: number;
  data: Record<string, unknown>;
  providerName: string;
};

/**
 * Handles an autonomous investigation request securely on the server.
 */
export async function handleInvestigateRequest(
  body: unknown,
  env: Record<string, string | undefined> = process.env
): Promise<InvestigateHandlerResult> {
  // 1. Validate prompt shape
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      data: { error: "Invalid request payload: Expected JSON object." },
      providerName: "error",
    };
  }

  const prompt = body as ModelPrompt;
  if (!prompt.caseDetail || !prompt.caseDetail.bankTransaction) {
    return {
      status: 400,
      data: { error: "Invalid request payload: Missing caseDetail.bankTransaction." },
      providerName: "error",
    };
  }

  // 2. Check for Gemini / Google API key in server environment
  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || "";
  const model = env.GEMINI_MODEL || "gemini-flash-lite-latest";

  if (!apiKey) {
    return {
      status: 200,
      data: {
        fallback: true,
        reason: "GEMINI_API_KEY is not configured in server environment.",
      },
      providerName: "deterministic_accounting_model_v1",
    };
  }

  // 3. Invoke server-side GeminiModelProvider
  try {
    const provider = new GeminiModelProvider({
      apiKey,
      model,
      timeoutMs: 25_000,
    });

    const analysis = await provider.analyzeCase(prompt);
    return {
      status: 200,
      data: {
        ...analysis,
        _modelProvider: provider.name,
        _model: model,
        _usage: analysis.usage,
      },
      providerName: provider.name,
    };
  } catch (err: any) {
    // Sanitize error message to prevent any accidental leakage of keys or URLs
    const rawMsg = err?.message || "Unknown error during model inference";
    const sanitizedMsg = rawMsg
      .replace(/key=[^&\s]+/gi, "key=[REDACTED]")
      .replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_API_KEY]");

    return {
      status: 502,
      data: {
        error: `LLM inference failed: ${sanitizedMsg}`,
        fallback: true,
      },
      providerName: "error",
    };
  }
}
