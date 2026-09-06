// src/evaluation/cli.ts
// Command-line entry point to execute evaluation and print report.

import { runEvaluation, formatEvaluationReport } from "./runner";

function main() {
  const report = runEvaluation();
  const summary = formatEvaluationReport(report);
  console.log(summary);
}

main();
