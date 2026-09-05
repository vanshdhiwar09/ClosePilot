# ClosePilot — Architecture

## Design summary

This is an implementation proposal for a small, local-first hackathon application. It separates deterministic reconciliation from agent orchestration and keeps all initial data synthetic and versioned. The system is intentionally a single workflow service and a single review dashboard—not a multi-agent system or financial platform.

## Proposed repository structure

```text
apps/
  api/                     # workflow API and local orchestration entry point
  web/                     # reviewer dashboard and close-report view
packages/
  schemas/                 # TypeScript types and runtime validators
  reconciliation/          # deterministic normalization, matching, exceptions
  evaluation/              # fixture runner and metrics calculation
  report/                  # close-package assembly and rendering model
data/
  fixtures/                # versioned synthetic input datasets
  ground-truth/            # expected matches, exceptions, and review outcomes
docs/
  PROJECT_SPEC.md
  ARCHITECTURE.md
tests/
  unit/
  integration/
  fixtures/
```

For the first implementation session, a simpler single `src/` layout is acceptable if a monorepo would slow delivery. The module boundaries above remain the intended boundaries regardless of folder layout.

## Canonical data model

All records include `id`, `source`, `sourceRecordId`, `schemaVersion`, `ingestedAt`, and an immutable `raw` reference or raw payload hash. Monetary values use decimal strings (for example, `"1250.00"`) and ISO currency codes; floating-point arithmetic is prohibited for reconciliation decisions.

### BankTransaction

```ts
type BankTransaction = {
  id: string; accountId: string; transactionDate: string; postedDate?: string;
  amount: string; currency: string; direction: "debit" | "credit";
  description: string; counterparty?: string; reference?: string;
  source: "synthetic_bank"; sourceRecordId: string; schemaVersion: "1";
  ingestedAt: string; rawHash: string;
};
```

### LedgerEntry

```ts
type LedgerEntry = {
  id: string; accountId: string; entryDate: string; postingDate?: string;
  debit: string; credit: string; currency: string; vendor?: string;
  memo?: string; reference?: string; documentIds?: string[];
  source: "synthetic_ledger" | "synthetic_subledger";
  sourceRecordId: string; schemaVersion: "1"; ingestedAt: string; rawHash: string;
};
```

The derived signed ledger amount is calculated once by deterministic code as `debit - credit`; source debit and credit are retained for auditability.

### SupportingDocument and ChartOfAccount

```ts
type SupportingDocument = {
  id: string; documentType: "invoice" | "receipt" | "statement" | "other";
  fileName: string; uri: string; sha256: string; vendor?: string;
  amount?: string; currency?: string; documentDate?: string;
  references?: string[]; source: "synthetic_document";
};

type ChartOfAccount = {
  accountId: string; accountCode: string; accountName: string;
  accountType: "asset" | "liability" | "equity" | "revenue" | "expense";
  active: boolean; currency?: string;
};
```

### Results, exceptions, and review

```ts
type ReconciliationResult = {
  id: string; bankTransactionId: string; candidateLedgerEntryIds: string[];
  matchedLedgerEntryIds: string[]; status: "matched" | "exception" | "review_required";
  matchMethod: string; confidence: "high" | "medium" | "low";
  amountDifference: string; evidenceIds: string[]; exceptionIds: string[];
  workflowVersion: string; createdAt: string;
};

type Exception = {
  id: string; resultId: string;
  type: "unmatched_transaction" | "amount_mismatch" | "timing_difference" |
        "duplicate" | "missing_documentation" | "potential_anomaly";
  severity: "low" | "medium" | "high"; status: "open" | "in_review" |
          "resolved" | "dismissed"; reasonCode: string; evidenceIds: string[];
  createdAt: string;
};

type HumanReview = {
  id: string; resultId: string; state: "queued" | "claimed" | "approved" |
          "rejected" | "needs_information" | "escalated";
  reviewerId?: string; decision?: "approve_match" | "reject_match" | "classify_timing" |
          "mark_duplicate" | "request_evidence" | "escalate";
  rationale?: string; evidenceIds: string[]; createdAt: string; decidedAt?: string;
};
```

### EvaluationCase

```ts
type EvaluationCase = {
  id: string; fixtureVersion: string; bankTransactionId: string;
  expectedLedgerEntryIds: string[]; expectedStatus: "matched" | "exception" | "review_required";
  expectedExceptionTypes: Exception["type"][];
  expectedAutoResolutionAllowed: boolean; notes?: string;
};
```

## Reconciliation pipeline

1. `load_data` imports a named synthetic fixture or adapter output.
2. `validate_data` validates schema, required fields, currencies, account references, and unique source identities.
3. `normalize_vendor` canonicalizes only comparison values while preserving originals.
4. `detect_duplicates` flags duplicate bank or ledger candidates before matching.
5. `match_transactions` creates candidate sets and applies deterministic rules.
6. `find_supporting_document` attaches documents using references and validated metadata.
7. `calculate_difference` calculates exact amount and date differences.
8. `investigate_exception` gathers existing evidence and produces a structured recommendation; it cannot mutate source data or approve an unsafe resolution.
9. The workflow emits a result, exception records, and a human-review task where required.
10. `generate_close_report` assembles aggregate counts and evidence-linked records.

## Deterministic matching strategy

Matching is performed per bank transaction, within the same account and currency unless an explicit documented rule allows otherwise.

1. **Exact match:** absolute signed amount equal, normalized reference equal, and transaction/posting dates within a configurable small window. Auto-resolve only when no duplicate or anomaly flag exists.
2. **Strong match:** amount equal plus normalized vendor or description token match, within the date window. Auto-resolve only when the candidate is unique and required evidence is present.
3. **Timing candidate:** amount and counterparty/reference match but date falls outside the exact window and within a broader configurable period. Create a timing-difference exception and route to review unless policy explicitly permits auto-resolution.
4. **Ambiguous candidate:** multiple qualifying ledger entries, conflicting evidence, or unmatched amount. Never auto-resolve; create an exception.

The matching implementation returns a rule trace—not opaque model scores. Configurable thresholds and date windows are versioned with the workflow. Split or many-to-one matches are deferred until explicitly added and must not be inferred in the first release.

## Exception classification

Classification is rule-based and can attach more than one type:

| Condition | Exception |
|---|---|
| No eligible candidate | `unmatched_transaction` |
| Candidate exists but amounts differ | `amount_mismatch` |
| Amount/reference align outside date policy | `timing_difference` |
| Same account, amount, normalized reference, and near-identical dates recur | `duplicate` |
| Required linked document is absent or fails metadata validation | `missing_documentation` |
| Deterministic outlier rule or contradictory signals fire | `potential_anomaly` |

`potential_anomaly` is a prompt for review, not a fraud claim. Initial anomaly rules should be transparent, such as a transaction amount beyond a configured account-level historical threshold in the fixture dataset.

## Evidence model

Evidence is append-only, content-addressed where practical, and linked to a result or exception.

```ts
type EvidenceItem = {
  id: string; kind: "source_record" | "match_rule" | "calculation" | "document" |
                    "validation" | "human_decision" | "agent_summary";
  subjectType: "result" | "exception" | "review"; subjectId: string;
  sourceId?: string; locator?: string; contentHash?: string;
  payload: Record<string, unknown>; createdAt: string;
};
```

Rule traces and calculations carry their inputs, output, and rule version. Agent summaries are clearly labelled as interpretations and must cite existing evidence IDs. A report never treats an agent summary as primary financial evidence.

## Human-review state machine

```text
queued → claimed → approved
                 ↘ rejected
                 ↘ needs_information → queued
                 ↘ escalated
```

- Workflow creates `queued` review for every case requiring human approval.
- A reviewer claims it, reads linked evidence, and records one structured decision plus rationale.
- `approved` means the proposed reconciliation classification is accepted; it does not post a journal.
- `rejected` keeps the result unresolved or records a reviewer-selected exception classification.
- `needs_information` returns the case to evidence collection and then requeues it.
- `escalated` is terminal for the demo workflow and requires external team handling.

Only an authenticated reviewer role may transition from `claimed` to a decision state. The first hackathon build may use a simple local demo identity but must retain reviewer identity in the audit record.

## Agent responsibilities

There is one orchestration agent, not a swarm. It may call only the defined tools and must return structured outputs.

- Select workflow steps based on data-validation and exception status.
- Ask deterministic tools for calculations, candidates, duplicate findings, and documents.
- Investigate by organizing available evidence and explaining why a case was routed or proposed for resolution.
- Generate an evidence-cited close narrative.
- Never calculate authoritative values independently, fabricate a document, change source records, approve low-confidence cases, post a journal, or move money.

When no LLM is configured, the deterministic workflow and review dashboard remain fully functional; only investigation narration is reduced.

## Tool contracts

All tools receive a `runId`, `workflowVersion`, and typed input; all return `{ status, data, evidenceIds, warnings }`. Errors are structured and do not silently coerce invalid financial data.

```ts
load_data({ fixtureId?: string, bank?: InputRef, ledger?: InputRef,
            documents?: InputRef, chartOfAccounts?: InputRef })
  => { bankTransactions, ledgerEntries, documents, chartOfAccounts, importIssues }

validate_data({ bankTransactions, ledgerEntries, documents, chartOfAccounts })
  => { validRecords, validationIssues, evidenceIds }

normalize_vendor({ value: string, aliases?: Record<string, string> })
  => { original, normalized, appliedRule }

match_transactions({ bankTransactionId, ledgerEntries, configVersion })
  => { candidates, selectedMatch?, ruleTrace, requiresReview }

detect_duplicates({ recordType: "bank" | "ledger", records, configVersion })
  => { duplicateGroups, evidenceIds }

find_supporting_document({ ledgerEntryId?, bankTransactionId?, references, documents })
  => { matches, missingRequired, evidenceIds }

investigate_exception({ exceptionId, resultId, evidenceIds })
  => { findings, recommendation, requiredReview: boolean, citedEvidenceIds }

calculate_difference({ leftAmount: string, rightAmount: string,
                       leftDate?: string, rightDate?: string })
  => { amountDifference, dateDifferenceDays?, calculationEvidenceId }

generate_close_report({ runId, results, exceptions, reviews })
  => { report, evidenceIndex, unresolvedItems }
```

`investigate_exception` may use an LLM only for explanation and evidence organization. Its response is invalid if `citedEvidenceIds` do not exist in the run.

## Evaluation and ground truth

Ground truth lives separately from input fixtures under `data/ground-truth/<fixtureVersion>.json`. Each `EvaluationCase` names expected links, expected status, exception types, and whether automatic resolution was allowed. A versioned evaluation runner compares workflow output to those labels.

The runner produces raw counts and derived metrics: auto-reconciliation rate, precision, exception recall, false auto-close rate, processing time, and human-review load. It records fixture version, workflow version, matcher configuration version, timestamp, and per-case discrepancies. No metric is displayed as an achieved result before the runner is executed.

## Improvement loop

Store each run's failures as structured categories such as wrong candidate, missed duplicate, false auto-close, weak evidence link, or unnecessary review. A proposed improvement changes one named artifact: matching rule/configuration, validator, tool contract, prompt, or UI review flow. Re-run the same fixture set and compare the recorded outputs. Do not modify ground truth to make a workflow appear better; changes to labels require an explicit rationale and label version.

## Backend and frontend boundaries

The backend owns fixture loading, schema validation, decimal calculations, matching, exception creation, state transitions, evidence persistence, report assembly, and evaluations. It exposes a small local JSON API or equivalent server actions.

The frontend only displays runs, evidence-linked match decisions, the review queue, individual case detail, reviewer decisions, and the close report. It must not reimplement matching logic or make financial decisions client-side. A static local store (files or SQLite) is sufficient for the demo; choose one during implementation and document it.

## Testing strategy

- Unit tests for decimal arithmetic, date windows, vendor normalization, each matching rule, duplicate detection, exception classification, and state-transition guards.
- Fixture-based integration tests for a complete ingest-to-report run, including matched, ambiguous, duplicate, missing-document, timing, and anomaly cases.
- Evaluation tests asserting metric formulas and that a false auto-close is counted correctly.
- Contract tests for tool input/output validation and missing-evidence failures.
- Lightweight UI tests for the review queue and decision controls after the frontend exists.

Use only synthetic test data. Tests should assert evidence IDs and rule traces, not model prose.

## Exact implementation order for next AO sessions

1. Create the minimal TypeScript project skeleton and shared runtime schemas; do not add the UI yet.
2. Add one small, labelled synthetic fixture set and matching ground truth.
3. Implement validation, decimal-safe calculation, vendor normalization, duplicate detection, and exact/strong/ambiguous matching with unit tests.
4. Implement result, exception, and evidence persistence for one workflow run, plus the evaluation runner.
5. Implement the human-review state machine and a minimal local API.
6. Build the narrow review dashboard and close-report view.
7. Add the optional single-agent investigation narration behind the deterministic tools; validate citations.
8. Run evaluation, inspect real failures, make one measured improvement, and record the before/after outcome.
