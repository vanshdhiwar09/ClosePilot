// src/observability/env.ts
// Lightweight .env loader to ensure environment variables (e.g. NEATLOGS_API_KEY)
// are available across local runs and test executions without external dependencies.

import * as fs from "fs";
import * as path from "path";

let envLoaded = false;

/**
 * Loads environment variables from the root .env file if it exists.
 * Does not overwrite variables already set in process.env.
 */
export function loadLocalEnv(rootDir?: string): Record<string, string> {
  if (envLoaded && !rootDir) {
    return {};
  }

  const baseDir =
    rootDir ||
    (typeof process !== "undefined" && typeof process.cwd === "function"
      ? process.cwd()
      : "");

  if (!fs?.existsSync || !path?.resolve || !baseDir) {
    envLoaded = true;
    return {};
  }

  const envPath = path.resolve(baseDir, ".env");

  if (!fs.existsSync(envPath)) {
    envLoaded = true;
    return {};
  }

  const loadedVars: Record<string, string> = {};

  try {
    const content = fs.readFileSync(envPath, "utf-8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) {
        continue;
      }

      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();

      // Remove wrapping quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.substring(1, value.length - 1);
      }

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
      loadedVars[key] = value;
    }

    envLoaded = true;
  } catch {
    // Non-fatal if .env cannot be read
  }

  return loadedVars;
}

// Initial auto-load
loadLocalEnv();
