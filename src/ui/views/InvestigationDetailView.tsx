import React, { useState, useEffect } from "react";
import { CaseInvestigationDetail, HumanReviewAction } from "../adapter/types";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { Badge } from "../components/primitives/Badge";
import { StatusPill, StatusPillVariant } from "../components/primitives/StatusPill";

interface InvestigationDetailViewProps {
  onBack: () => void;
  caseDetail: CaseInvestigationDetail;
  onApplyAction: (
    caseId: string,
    action: HumanReviewAction,
    reason: string
  ) => Promise<void>;
}

export const InvestigationDetailView: React.FC<InvestigationDetailViewProps> = ({
  caseDetail,
  onBack,
  onApplyAction,
}) => {
  const { summary, flaggedReason, investigation, policyEvaluations, toolCalls, traceEvents, evidence, candidateEntries, decisionHistory, allowedActions } = caseDetail;

  // Human Review Form State
  const [selectedAction, setSelectedAction] = useState<HumanReviewAction | null>(
    allowedActions.length > 0 ? allowedActions[0] : null
  );

  useEffect(() => {
    if (allowedActions.length > 0 && (!selectedAction || !allowedActions.includes(selectedAction))) {
      setSelectedAction(allowedActions[0]);
    } else if (allowedActions.length === 0) {
      setSelectedAction(null);
    }
  }, [allowedActions, selectedAction]);

  const [decisionReason, setDecisionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Trace & Evidence Accordion State
  const [isTraceExpanded, setIsTraceExpanded] = useState(false);
  const [evidenceFilter, setEvidenceFilter] = useState<string>("all");
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  // Map review status to pill variant
  let statusVariant: StatusPillVariant = "human_review";
  if (summary.reviewStatus === "RESOLVED") statusVariant = "resolved";
  else if (summary.reviewStatus === "REJECTED") statusVariant = "rejected";
  else if (summary.reviewStatus === "WAITING_FOR_EVIDENCE") statusVariant = "waiting_evidence";

  // Map risk level to badge variant
  let riskBadgeVariant: "rose" | "amber" | "emerald" | "neutral" = "rose";
  if (summary.riskLevel === "LOW") riskBadgeVariant = "emerald";
  else if (summary.riskLevel === "MEDIUM") riskBadgeVariant = "amber";

  // Confidence badge variant
  let confidenceVariant: "emerald" | "amber" | "neutral" = "emerald";
  if (summary.confidence === "MEDIUM") confidenceVariant = "amber";
  else if (summary.confidence === "LOW") confidenceVariant = "neutral";

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!selectedAction) {
      setActionError("Please select a review action.");
      return;
    }

    if (!decisionReason.trim()) {
      setActionError("A formal decision reason is required for audit compliance.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onApplyAction(summary.caseId, selectedAction, decisionReason.trim());
      setActionSuccess(`Successfully applied action "${selectedAction}" to case ${summary.caseId}.`);
      setDecisionReason("");
    } catch (err: any) {
      setActionError(err.message || "Failed to apply review action.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEvidence = evidenceFilter === "all"
    ? evidence
    : evidence.filter((e) => e.kind === evidenceFilter);

  const isTerminal = summary.reviewStatus === "RESOLVED" || summary.reviewStatus === "REJECTED";
  const isPolicyGuard = flaggedReason.code.includes("POLICY") || flaggedReason.code.includes("GUARD");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Top Bar & Case Summary Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5"></path>
                <path d="M12 19l-7-7 7-7"></path>
              </svg>
            }
          >
            Back to Exceptions
          </Button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--cp-text-muted)" }}>
              Run ID: <code className="cp-mono" style={{ color: "var(--cp-text-secondary)" }}>{investigation.runId}</code>
            </span>
          </div>
        </div>

        {/* Case Primary Card */}
        <div
          style={{
            padding: "20px 24px",
            backgroundColor: "var(--cp-bg-surface)",
            border: "1px solid var(--cp-border-default)",
            borderRadius: "var(--cp-radius-md)",
            boxShadow: "var(--cp-shadow-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span className="cp-mono" style={{ fontSize: "14px", fontWeight: 700, color: "var(--cp-text-primary)" }}>
                {summary.caseId}
              </span>
              <span style={{ color: "var(--cp-border-strong)" }}>•</span>
              <span className="cp-mono" style={{ fontSize: "14px", fontWeight: 600, color: "var(--cp-text-secondary)" }}>
                {summary.bankTxId}
              </span>
              <Badge variant={summary.isFlagship ? "rose" : "neutral"} size="sm">
                {summary.exceptionLabel}
              </Badge>
              <Badge variant={riskBadgeVariant} size="sm">
                Risk: {summary.riskLevel}
              </Badge>
              <StatusPill variant={statusVariant} label={summary.reviewStatusLabel} size="sm" />
            </div>

            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--cp-text-primary)",
                letterSpacing: "-0.02em",
                marginTop: "8px",
              }}
            >
              {summary.counterparty}
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginTop: "6px",
                fontSize: "12px",
                color: "var(--cp-text-secondary)",
              }}
            >
              <span>Date: <strong style={{ color: "var(--cp-text-primary)" }}>{summary.date}</strong></span>
              <span>•</span>
              <span>Ref: <strong style={{ color: "var(--cp-text-primary)" }}>{summary.reference}</strong></span>
              <span>•</span>
              <span>Desc: <span style={{ color: "var(--cp-text-muted)" }}>{summary.description}</span></span>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12px", color: "var(--cp-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
              Transaction Amount
            </div>
            <div
              className="cp-mono"
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: "var(--cp-text-primary)",
                letterSpacing: "-0.03em",
                marginTop: "2px",
              }}
            >
              {summary.amount}
            </div>
            <div style={{ fontSize: "12px", color: "var(--cp-text-secondary)", marginTop: "2px" }}>
              Currency: {summary.currency}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Investigation Summary & Why Flagged */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "16px" }}>
        {/* Why Flagged (Deterministic Engine Output) */}
        <Card
          title="Why Was This Flagged?"
          subtitle={
            isPolicyGuard
              ? "Deterministic policy guardrail from the reconciliation engine"
              : "Deterministic exception trigger from the reconciliation matching engine"
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                padding: "12px 14px",
                backgroundColor: isPolicyGuard ? "var(--cp-status-warning-bg)" : "var(--cp-status-danger-bg)",
                border: `1px solid ${isPolicyGuard ? "var(--cp-status-warning-border)" : "var(--cp-status-danger-border)"}`,
                borderRadius: "var(--cp-radius-sm)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  className="cp-mono"
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: isPolicyGuard ? "var(--cp-status-warning-text)" : "var(--cp-status-danger-text)",
                  }}
                >
                  {flaggedReason.code}
                </span>
                <Badge variant={isPolicyGuard ? "amber" : "rose"} size="sm">
                  {isPolicyGuard
                    ? "Policy Guardrail"
                    : summary.exceptionType === "potential_anomaly"
                    ? "Deterministic Outlier"
                    : summary.exceptionType === "ambiguous"
                    ? "Competing Candidates"
                    : "Deterministic Exception"}
                </Badge>
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: isPolicyGuard ? "var(--cp-status-warning-text)" : "var(--cp-status-danger-text)",
                  marginTop: "6px",
                  lineHeight: 1.4,
                }}
              >
                {flaggedReason.description}
              </p>
            </div>

            {flaggedReason.technicalDetails && (
              <div
                style={{
                  padding: "10px 12px",
                  backgroundColor: "var(--cp-bg-surface-elevated)",
                  border: "1px solid var(--cp-border-subtle)",
                  borderRadius: "var(--cp-radius-sm)",
                  fontSize: "12px",
                  color: "var(--cp-text-secondary)",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--cp-text-primary)" }}>
                  {isPolicyGuard ? "Policy Mandate: " : "Calculation Trigger: "}
                </span>
                {flaggedReason.technicalDetails}
              </div>
            )}
          </div>
        </Card>

        {/* Autonomous Agent Investigation */}
        <Card
          title="Autonomous Agent Investigation"
          subtitle="Advisory analysis generated by the Autonomous Investigator"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge variant="emerald" size="sm">Outcome: {investigation.outcome}</Badge>
              <Badge variant={confidenceVariant} size="sm">Confidence: {investigation.confidence}</Badge>
              <Badge variant={riskBadgeVariant} size="sm">Assessed Risk: {investigation.riskLevel}</Badge>
              {investigation.requiresHumanReview && (
                <Badge variant="amber" size="sm">Human Review Enforced</Badge>
              )}
              {investigation.modelProvider && (
                <Badge variant={investigation.modelProvider.includes("gemini") ? "emerald" : "neutral"} size="sm">
                  Provider: {investigation.modelProvider}
                </Badge>
              )}
            </div>

            <div style={{ fontSize: "13px", color: "var(--cp-text-primary)", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 600, color: "var(--cp-text-secondary)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
                Investigation Summary
              </div>
              {investigation.summary}
            </div>

            <div
              style={{
                padding: "10px 12px",
                backgroundColor: "var(--cp-bg-subtle)",
                borderRadius: "var(--cp-radius-sm)",
                fontSize: "12px",
                color: "var(--cp-text-secondary)",
                lineHeight: 1.4,
              }}
            >
              <strong style={{ color: "var(--cp-text-primary)" }}>Root Cause: </strong>
              {investigation.rootCause}
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Evidence + Agent Investigation Recommendation */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Agent Recommendation */}
        <Card
          title="Agent Recommendation"
          subtitle="Proposed resolution action submitted for human review approval"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                padding: "14px",
                backgroundColor: "var(--cp-bg-subtle)",
                border: "1px solid var(--cp-border-default)",
                borderRadius: "var(--cp-radius-sm)",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--cp-text-muted)" }}>
                Recommended Action
              </div>
              <div
                className="cp-mono"
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--cp-text-primary)",
                  marginTop: "4px",
                }}
              >
                {investigation.recommendation.action}
              </div>
              <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "8px", lineHeight: 1.4 }}>
                {investigation.recommendation.suggestedReason}
              </p>
              {investigation.recommendation.targetLedgerEntryId && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--cp-text-muted)" }}>
                  Target Ledger Entry: <strong className="cp-mono" style={{ color: "var(--cp-text-primary)" }}>{investigation.recommendation.targetLedgerEntryId}</strong>
                </div>
              )}
            </div>

            {/* Candidate Ledger Entries if available */}
            {candidateEntries.length > 0 && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--cp-text-secondary)", marginBottom: "6px" }}>
                  Candidate Ledger Entries ({candidateEntries.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {candidateEntries.map((le) => (
                    <div
                      key={le.id}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "var(--cp-radius-sm)",
                        border: "1px solid var(--cp-border-subtle)",
                        backgroundColor: "var(--cp-bg-surface-elevated)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "12px",
                      }}
                    >
                      <div>
                        <span className="cp-mono" style={{ fontWeight: 600, color: "var(--cp-text-primary)" }}>{le.id}</span>
                        <span style={{ color: "var(--cp-text-muted)", marginLeft: "8px" }}>{le.date}</span>
                        {le.reference && <span style={{ color: "var(--cp-text-muted)", marginLeft: "8px" }}>Ref: {le.reference}</span>}
                      </div>
                      <div className="cp-mono" style={{ fontWeight: 700, color: "var(--cp-text-primary)" }}>
                        {le.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Evidence Vault */}
        <Card
          title={`Verified Evidence Vault (${evidence.length})`}
          subtitle="Audit items cited and verified during deterministic pipeline & investigation"
          action={
            <div style={{ display: "flex", gap: "4px" }}>
              <Button
                variant={evidenceFilter === "all" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setEvidenceFilter("all")}
              >
                All
              </Button>
              <Button
                variant={evidenceFilter === "source_record" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setEvidenceFilter("source_record")}
              >
                Records
              </Button>
              <Button
                variant={evidenceFilter === "calculation" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setEvidenceFilter("calculation")}
              >
                Calcs
              </Button>
              <Button
                variant={evidenceFilter === "match_rule" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setEvidenceFilter("match_rule")}
              >
                Rules
              </Button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
            {filteredEvidence.map((ev) => {
              const isExpanded = expandedEvidenceId === ev.id;
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--cp-radius-sm)",
                    border: "1px solid var(--cp-border-default)",
                    backgroundColor: "var(--cp-bg-surface)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                    onClick={() => setExpandedEvidenceId(isExpanded ? null : ev.id)}
                  >
                    <div>
                      <span className="cp-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--cp-text-primary)" }}>
                        {ev.id}
                      </span>
                      <div style={{ fontSize: "12px", color: "var(--cp-text-secondary)", marginTop: "2px" }}>
                        {ev.summary}
                      </div>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {ev.kind}
                    </Badge>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: "8px",
                        paddingTop: "8px",
                        borderTop: "1px solid var(--cp-border-subtle)",
                        fontSize: "11px",
                      }}
                    >
                      <div style={{ color: "var(--cp-text-muted)", marginBottom: "4px" }}>
                        Locator: <code className="cp-mono">{ev.locator}</code>
                      </div>
                      <pre
                        className="cp-mono"
                        style={{
                          backgroundColor: "var(--cp-bg-subtle)",
                          padding: "8px",
                          borderRadius: "4px",
                          overflowX: "auto",
                          color: "var(--cp-text-secondary)",
                          fontSize: "11px",
                        }}
                      >
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 4. Collapsible Run Trace (Observability) */}
      <Card
        title="Observability Run Trace & Tool Execution"
        subtitle={`Audit trail of deterministic agent tool calls for run ${investigation.runId}`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTraceExpanded(!isTraceExpanded)}
          >
            {isTraceExpanded ? "Hide Trace" : `Expand Trace (${toolCalls.length} calls)`}
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: "var(--cp-text-secondary)" }}>
            <span>Tools Executed: <strong style={{ color: "var(--cp-text-primary)" }}>{toolCalls.length}</strong></span>
            <span>•</span>
            <span>Lifecycle Events: <strong style={{ color: "var(--cp-text-primary)" }}>{traceEvents.length}</strong></span>
            <span>•</span>
            <span>Execution Status: <strong style={{ color: "var(--cp-status-success-text)" }}>Verified</strong></span>
          </div>

          {isTraceExpanded && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--cp-text-secondary)", marginBottom: "4px" }}>
                Chronological Tool Execution Log
              </div>
              {toolCalls.map((tc, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--cp-radius-sm)",
                    backgroundColor: "var(--cp-bg-subtle)",
                    border: "1px solid var(--cp-border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: "var(--cp-status-success-text)", fontWeight: 700 }}>✓</span>
                    <span className="cp-mono" style={{ fontWeight: 600, color: "var(--cp-text-primary)" }}>
                      {tc.toolName}
                    </span>
                    <span className="cp-mono" style={{ color: "var(--cp-text-muted)", fontSize: "11px" }}>
                      {JSON.stringify(tc.sanitizedInput)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {tc.durationMs !== undefined && (
                      <span className="cp-mono" style={{ fontSize: "11px", color: "var(--cp-text-muted)" }}>
                        {tc.durationMs}ms
                      </span>
                    )}
                    <Badge variant="neutral" size="sm">completed</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* 5. Policy Guardrails & Compliance */}
      <Card
        title="Safety Policy Guardrails & Compliance"
        subtitle="Deterministic safety checks evaluated by PolicyValidator"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {policyEvaluations.map((p, idx) => (
            <div
              key={idx}
              style={{
                padding: "12px 14px",
                borderRadius: "var(--cp-radius-sm)",
                backgroundColor: p.isPermitted ? "var(--cp-status-success-bg)" : "var(--cp-status-danger-bg)",
                border: `1px solid ${p.isPermitted ? "var(--cp-status-success-border)" : "var(--cp-status-danger-border)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="cp-mono" style={{ fontSize: "12px", fontWeight: 700, color: p.isPermitted ? "var(--cp-status-success-text)" : "var(--cp-status-danger-text)" }}>
                    {p.policyRule}
                  </span>
                  {p.forcedHumanReview && (
                    <Badge variant="amber" size="sm">Human Review Enforced</Badge>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: p.isPermitted ? "var(--cp-status-success-text)" : "var(--cp-status-danger-text)", marginTop: "4px" }}>
                  {p.policyReason}
                </div>
              </div>

              <Badge variant={p.isPermitted ? "emerald" : "rose"} size="sm">
                {p.isPermitted ? "Permitted" : "Violation"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* 6. Human Decision Console */}
      <Card
        title="Human Review Decision Console"
        subtitle="Authoritative human action interface enforcing HumanReviewSession state machine transitions"
      >
        {isTerminal ? (
          <div
            style={{
              padding: "16px 20px",
              backgroundColor: "var(--cp-bg-subtle)",
              borderRadius: "var(--cp-radius-sm)",
              border: "1px solid var(--cp-border-default)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "20px" }}>🔒</span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--cp-text-primary)" }}>
                Case Resolution Closed ({summary.reviewStatus})
              </div>
              <div style={{ fontSize: "12px", color: "var(--cp-text-secondary)", marginTop: "2px" }}>
                This case has reached terminal status. The decision has been permanently sealed into the audit trail.
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleActionSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {actionError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: "var(--cp-status-danger-bg)",
                  border: "1px solid var(--cp-status-danger-border)",
                  color: "var(--cp-status-danger-text)",
                  fontSize: "12px",
                }}
              >
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: "var(--cp-status-success-bg)",
                  border: "1px solid var(--cp-status-success-border)",
                  color: "var(--cp-status-success-text)",
                  fontSize: "12px",
                }}
              >
                {actionSuccess}
              </div>
            )}

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--cp-text-secondary)", display: "block", marginBottom: "8px" }}>
                Select Reviewer Action
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {allowedActions.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant={selectedAction === action ? "primary" : "outline"}
                    size="md"
                    pill
                    onClick={() => setSelectedAction(action)}
                  >
                    {action.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--cp-text-secondary)", display: "block", marginBottom: "6px" }}>
                Mandatory Reviewer Rationale
              </label>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Enter auditable business rationale justifying this resolution..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--cp-radius-sm)",
                  border: "1px solid var(--cp-border-default)",
                  backgroundColor: "var(--cp-bg-surface)",
                  color: "var(--cp-text-primary)",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "12px", color: "var(--cp-text-muted)" }}>
                Authorizing Reviewer: <strong style={{ color: "var(--cp-text-primary)" }}>Sarah Lin (Senior Finance Controller)</strong>
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                pill
                disabled={isSubmitting || !selectedAction}
              >
                {isSubmitting ? "Executing Decision..." : `Execute ${selectedAction || "Action"}`}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* 7. Decision History Audit Log */}
      {decisionHistory.length > 0 && (
        <Card
          title={`Decision Audit History (${decisionHistory.length})`}
          subtitle="Immutable log of human review decisions recorded for this case"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {decisionHistory.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--cp-radius-sm)",
                  border: "1px solid var(--cp-border-subtle)",
                  backgroundColor: "var(--cp-bg-subtle)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="cp-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--cp-text-primary)" }}>
                      {d.action}
                    </span>
                    <Badge variant="neutral" size="sm">{d.fromState} → {d.toState}</Badge>
                    <span style={{ fontSize: "11px", color: "var(--cp-text-muted)" }}>{d.timestamp}</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px", lineHeight: 1.4 }}>
                    {d.reason}
                  </p>
                  <div style={{ fontSize: "11px", color: "var(--cp-text-muted)", marginTop: "4px" }}>
                    Reviewer: <strong style={{ color: "var(--cp-text-primary)" }}>{d.reviewerName}</strong> ({d.reviewerRole})
                  </div>
                </div>
                <span className="cp-mono" style={{ fontSize: "11px", color: "var(--cp-text-muted)" }}>
                  {d.id}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
