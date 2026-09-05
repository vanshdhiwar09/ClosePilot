# ClosePilot — Project Specification

## Purpose

ClosePilot is a month-end account reconciliation workflow for finance teams. It ingests synthetic financial records, validates and normalizes them, reconciles bank activity with ledger or subledger records, investigates exceptions using available evidence, and produces an evidence-backed close package. It may resolve only high-confidence, safe cases; uncertain or unsafe cases require human review.

## Hackathon scope

This project is for **Track 2 — Autonomous Office of the CFO**. The product focus is a narrow, demonstrable account-reconciliation workflow, not a replacement for an ERP or accounting team.

The intended workflow is:

1. Load synthetic bank transactions, ledger/subledger records, supporting documents, and chart-of-accounts data.
2. Validate required fields and normalize comparable fields such as vendor names and dates.
3. Reconcile bank transactions to ledger records with deterministic rules.
4. Detect and classify exceptions.
5. Collect and link available evidence for each result.
6. Auto-resolve only safe, high-confidence cases according to explicit rules.
7. Route all uncertain, incomplete, anomalous, or unsafe cases to a human reviewer.
8. Record the decision, rationale, and evidence trail.
9. Generate a reconciliation result and close package.
10. Evaluate outcomes against labelled ground truth and use measured failures to improve the workflow.

## Supported inputs (initial release)

- Synthetic bank transactions
- Synthetic general-ledger and subledger records
- Synthetic supporting documents and document metadata
- Synthetic chart of accounts

Initial import formats are a small, versioned JSON fixture format and CSV adapters. Data remains local to the hackathon application.

## Initial exception taxonomy

- Unmatched transaction
- Amount mismatch
- Timing difference
- Duplicate
- Missing documentation
- Potential anomaly

One record may have multiple exceptions. An exception is a finding, not an accounting adjustment or a journal entry.

## Non-negotiable operating principles

### Evidence first

Every reconciliation outcome must retain links to the input records, matching-rule results, calculations, documents, and any human decision that support it. The system must distinguish missing evidence from evidence that disproves a proposed match.

### Deterministic financial logic

Amounts, date windows, duplicate checks, score thresholds, and match decisions are programmatic and reproducible. An LLM, if used, may orchestrate approved tools, summarize evidence, and propose an investigation path; it must not guess balances, manufacture evidence, or override deterministic controls.

### Human review is required

Cases with insufficient evidence, low confidence, conflicting evidence, anomaly flags, unsafe actions, or a rule requiring review must enter the human-review queue. Human review is also the only mechanism for approving a non-standard resolution. ClosePilot does not autonomously post journals or move money.

### Truthful evaluation and claims

Reported metrics must be computed from versioned labelled test data. Do not fabricate evaluation results, capabilities, integrations, sponsor usage, or AO usage. Until an evaluation run exists, describe metrics as planned, not achieved.

### AO development requirement

AO is mandatory for the actual hackathon development workflow. Work sessions, task ownership, and implementation progress must be conducted through the configured AO environment. This requirement does not imply a product feature or third-party integration.

## Evaluation metrics

Metrics are calculated only on cases with applicable ground truth:

- **Auto-reconciliation rate:** eligible cases automatically resolved / all eligible cases
- **Precision:** correct automatic resolutions / all automatic resolutions
- **Exception recall:** ground-truth exceptions detected / all ground-truth exceptions
- **False auto-close rate:** incorrect automatic resolutions / all automatic resolutions
- **Processing time:** elapsed time per run and per case
- **Human review load:** cases sent to review / all processed cases, with review time when available

## Improvement loop

The project follows a measured loop: **Build → Evaluate → Analyze failures → Change workflow, deterministic rule, tool contract, or prompt → Evaluate again**. Each evaluation run records fixture, workflow, and rule versions so changes can be compared without rewriting history.

## Boundaries and exclusions

ClosePilot will not build or claim to be:

- A full ERP or accounting platform
- A generic AI CFO chatbot
- A general-purpose agent builder or multi-agent swarm
- A real bank, card, payment, lending, consumer-banking, trading, or money-movement integration
- A system for autonomous journal posting, payment approval, or funds transfer
- A production-grade financial data warehouse, identity system, or document-management platform

No paid service is required. The out-of-pocket target is **₹0**. No secrets, API keys, proprietary bank data, or real customer financial records may be committed to the repository.

## Definition of a credible demo

A credible demo shows synthetic records flowing through a deterministic match and exception workflow, an evidence trail, a human-review decision for an uncertain case, a generated close report, and evaluation against labelled fixture data. It must clearly disclose synthetic inputs and any unimplemented capabilities.
