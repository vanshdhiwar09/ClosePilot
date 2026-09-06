// src/ui/views/InvestigationsView.tsx
import React from "react";
import { ExceptionCaseSummary } from "../adapter/types";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { StatusPill, StatusPillVariant } from "../components/primitives/StatusPill";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";

interface InvestigationsViewProps {
  cases: ExceptionCaseSummary[];
  onSelectCase: (caseId: string) => void;
  onNavigate: (tab: NavTabId) => void;
}

export const InvestigationsView: React.FC<InvestigationsViewProps> = ({
  cases,
  onSelectCase,
  onNavigate,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--cp-text-primary)" }}>
              Autonomous Investigation Agent Runs
            </h1>
            <Badge variant="indigo" size="sm">
              {cases.length} Completed Run{cases.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px" }}>
            Read-only autonomous investigations operate strictly above the accounting layer with zero mutation of financial state.
          </p>
        </div>
        <Button variant="outline" size="md" pill onClick={() => onNavigate("overview")}>
          ← Back to Overview
        </Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        <Card title="Read-Only Toolbox Telemetry" subtitle="Enforced non-mutating ground truth tools">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { name: "get_case", desc: "Load transaction, candidates & exceptions" },
              { name: "get_evidence", desc: "Extract source, calculation & doc records" },
              { name: "get_ledger_entry", desc: "Inspect candidate ledger records" },
              { name: "get_related_transactions", desc: "Search vendor & temporal history" },
              { name: "get_case_history", desc: "Check human review decisions" },
            ].map((tool) => (
              <div
                key={tool.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: "var(--cp-bg-subtle)",
                }}
              >
                <div>
                  <span className="cp-mono" style={{ fontSize: "12px", fontWeight: 600, color: "var(--cp-text-primary)" }}>
                    {tool.name}
                  </span>
                  <div style={{ fontSize: "11px", color: "var(--cp-text-muted)" }}>{tool.desc}</div>
                </div>
                <Badge variant="neutral" size="sm">Active</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Deterministic Safety Guardrails" subtitle="Policy checks verified before recommendation">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { rule: "EVIDENCE_CITATION_INTEGRITY", desc: "Forbids citing nonexistent evidence IDs" },
              { rule: "AUTO_RESOLVE_GUARD", desc: "Rejects auto-resolve on active exceptions" },
              { rule: "UNMATCHED_TRANSACTION_GUARD", desc: "Blocks approval when no candidate exists" },
              { rule: "MISSING_DOCUMENTATION_GUARD", desc: "Blocks approval when required invoice is absent" },
              { rule: "HIGH_VALUE_ANOMALY_GUARD", desc: "Forces human review on statistical outliers" },
            ].map((p) => (
              <div
                key={p.rule}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: "var(--cp-bg-subtle)",
                }}
              >
                <div>
                  <span className="cp-mono" style={{ fontSize: "11px", fontWeight: 600, color: "var(--cp-text-primary)" }}>
                    {p.rule}
                  </span>
                  <div style={{ fontSize: "11px", color: "var(--cp-text-muted)" }}>{p.desc}</div>
                </div>
                <Badge variant="emerald" size="sm">Active</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Investigation Cases Log" subtitle="Select any investigation to inspect full run trace, evidence & decision console">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {cases.map((c) => {
            let statusVariant: StatusPillVariant = "human_review";
            if (c.reviewStatus === "RESOLVED") statusVariant = "resolved";
            else if (c.reviewStatus === "REJECTED") statusVariant = "rejected";
            else if (c.reviewStatus === "WAITING_FOR_EVIDENCE") statusVariant = "waiting_evidence";

            return (
              <div
                key={c.caseId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: c.isFlagship ? "rgba(168, 34, 34, 0.02)" : "var(--cp-bg-surface)",
                  border: `1px solid ${c.isFlagship ? "var(--cp-status-danger-border)" : "var(--cp-border-default)"}`,
                  cursor: "pointer",
                }}
                onClick={() => onSelectCase(c.caseId)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: c.isFlagship ? "var(--cp-status-danger-dot)" : "var(--cp-status-warning-dot)" }} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="cp-mono" style={{ fontWeight: 700, fontSize: "13px", color: "var(--cp-text-primary)" }}>
                        {c.caseId}
                      </span>
                      <span className="cp-mono" style={{ fontSize: "12px", color: "var(--cp-text-muted)" }}>
                        {c.bankTxId}
                      </span>
                      <Badge variant={c.isFlagship ? "rose" : "neutral"} size="sm">
                        {c.exceptionLabel}
                      </Badge>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--cp-text-secondary)", marginTop: "2px" }}>
                      {c.counterparty} • <strong className="cp-mono">{c.amount}</strong> — Rec: <code className="cp-mono">{c.recommendationAction}</code>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Badge variant={c.riskLevel === "LOW" ? "emerald" : c.riskLevel === "MEDIUM" ? "amber" : "rose"} size="sm">
                    Risk: {c.riskLevel}
                  </Badge>
                  <StatusPill variant={statusVariant} label={c.reviewStatusLabel} size="sm" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCase(c.caseId);
                    }}
                  >
                    Inspect Trace →
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
