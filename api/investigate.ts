// api/investigate.ts
// Production serverless endpoint for ClosePilot autonomous LLM investigations.
// Compatible with Vercel, Netlify, and standard Node.js serverless runtimes.

import type { IncomingMessage, ServerResponse } from "node:http";
import { handleInvestigateRequest } from "../src/server/investigate-handler";

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // fallback
      }
    }
    if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        const raw = Buffer.concat(chunks).toString("utf-8");
        if (raw) {
          body = JSON.parse(raw);
        }
      } catch {
        // stream may already be consumed
      }
    }

    const result = await handleInvestigateRequest(body);
    // Always return HTTP 200 so Vercel edge proxy never intercepts with HTML 500/502 pages
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result.data));
  } catch (err: any) {
    console.error("[api/investigate] Unhandled serverless error:", err);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: `Serverless error: ${err?.message || String(err)}`,
        fallback: true,
      })
    );
  }
}
