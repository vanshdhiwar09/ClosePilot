// api/trace.ts
// Production serverless endpoint for ClosePilot investigation observability traces.
// Securely proxies traces to Neatlogs and persists local logging fallbacks.

import type { IncomingMessage, ServerResponse } from "node:http";
import { handleTraceRequest } from "../src/server/trace-handler";

export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  let body = req.body;
  if (!body) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const raw = Buffer.concat(chunks).toString("utf-8");
    try {
      body = JSON.parse(raw);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }
  }

  const result = await handleTraceRequest(body);
  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(result.data));
}
