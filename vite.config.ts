import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { handleInvestigateRequest } from "./src/server/investigate-handler";
import { handleTraceRequest } from "./src/server/trace-handler";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      {
        name: "closepilot-api-middleware",
        configureServer(server) {
          server.middlewares.use("/api/investigate", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ error: "Method Not Allowed" }));
            }

            const raw = await new Promise<string>((resolve, reject) => {
              const chunks: Buffer[] = [];
              req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
              req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
              req.on("error", reject);
            });
            let body: any;
            try {
              body = JSON.parse(raw);
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ error: "Invalid JSON body" }));
            }

            const currentEnv = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
            const result = await handleInvestigateRequest(body, currentEnv);
            res.statusCode = result.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result.data));
          });

          server.middlewares.use("/api/trace", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ error: "Method Not Allowed" }));
            }

            const raw = await new Promise<string>((resolve, reject) => {
              const chunks: Buffer[] = [];
              req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
              req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
              req.on("error", reject);
            });
            let body: any;
            try {
              body = JSON.parse(raw);
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              return res.end(JSON.stringify({ error: "Invalid JSON body" }));
            }

            const currentEnv = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
            const result = await handleTraceRequest(body, currentEnv);
            res.statusCode = result.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result.data));
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      open: false,
      watch: {
        // Ignore the screenshots directory — dropping images there must not crash the dev server
        ignored: ["**/docs/screenshots/**"],
      },
    },
  };
});
