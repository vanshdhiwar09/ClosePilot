// src/server/trace-handler.ts
// Server-side trace telemetry proxy and local fallback recorder for ClosePilot.
// Securely holds NEATLOGS_API_KEY on the server — never exposes secrets to the browser.
// Always persists a local copy of the trace in .logs/investigations/ as resilient offline fallback.

import * as fs from "fs";
import * as path from "path";

export type TraceHandlerResult = {
  status: number;
  data: Record<string, unknown>;
};

export async function handleTraceRequest(
  body: unknown,
  env: Record<string, string | undefined> = process.env
): Promise<TraceHandlerResult> {
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      data: { error: "Invalid trace payload: Expected JSON object." },
    };
  }

  const tracePayload = body as Record<string, unknown>;
  const traceId = (tracePayload.traceId as string) || `TRACE-${Date.now()}`;

  // 1. Always record to local filesystem fallback
  try {
    const cwd = process.cwd();
    if (cwd && fs?.writeFileSync && path?.join) {
      const logDir = path.resolve(cwd, ".logs", "investigations");
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const filePath = path.join(logDir, `${traceId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(tracePayload, null, 2), "utf-8");
    }
  } catch {
    // Non-fatal filesystem logging
  }

  // 2. Check for Neatlogs API key
  const apiKey = env.NEATLOGS_API_KEY || env.NEATLOGS_KEY || "";
  if (!apiKey) {
    return {
      status: 200,
      data: {
        success: true,
        mode: "local_only",
        message: "Trace recorded locally. NEATLOGS_API_KEY not configured.",
      },
    };
  }

  // 3. Forward to Neatlogs cloud ingestion endpoint
  const endpoint = "https://ingest.neatlogs.com/v1/trace";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(tracePayload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        status: 200, // Non-fatal: acknowledge receipt to client so financial workflow is never interrupted
        data: {
          success: true,
          mode: "local_fallback",
          warning: `Neatlogs HTTP ${response.status}: ${errText}`,
        },
      };
    }

    const resJson = await response.json().catch(() => ({}));
    return {
      status: 200,
      data: {
        success: true,
        neatlogsResponse: resJson,
      },
    };
  } catch (err: any) {
    return {
      status: 200, // Non-fatal: acknowledge receipt to client so financial workflow is never interrupted
      data: {
        success: true,
        mode: "local_fallback",
        warning: `Neatlogs ingest network error: ${err.message}`,
      },
    };
  }
}
