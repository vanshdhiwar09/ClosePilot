// src/ui/views/InvestigationsView.tsx
import React from "react";
import { OverviewDataViewModel } from "../adapter/types";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { StatusPill } from "../components/primitives/StatusPill";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";

interface InvestigationsViewProps {
  data: OverviewDataViewModel;
  onNavigate: (tab: NavTabId) => void;
}

export const InvestigationsView: React.FC<InvestigationsViewProps> = ({ data, onNavigate }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Autonomous Investigation Agent Runs
            </h1>
            <Badge variant="indigo" size="sm">
              7 Completed Runs
            </Badge>
          </div>
          <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px" }}>
            Read-only autonomous investigations operate strictly above the accounting layer. Zero mutation
            of financial state.
          </p>
        </div>
        <Button variant="outline" size="md" onClick={() => onNavigate("overview")}>
          ← Back to Overview
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        <Card title="Read-Only Toolbox Telemetry" subtitle="Enforced non-mutating ground truth">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { name: "get_case", count: 8, desc: "Load transaction, candidates & exceptions" },
              { name: "get_evidence", count: 7, desc: "Extract source, calculation & doc records" },
              { name: "get_ledger_entry", count: 9, desc: "Inspect candidate ledger records" },
              { name: "get_related_transactions", count: 4, desc: "Search vendor & temporal history" },
              { name: "get_case_history", count: 7, desc: "Check human review decisions" },
            ].map((tool) => (
              <div
                key={tool.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: "var(--cp-bg-canvas-subtle)",
                }}
              >
                <div>
                  <span className="cp-mono" style={{ fontSize: "12px", fontWeight: 600 }}>
                    {tool.name}
                  </span>
                  <div style={{ fontSize: "11px", color: "var(--cp-text-tertiary)" }}>{tool.desc}</div>
                </div>
                <Badge variant="neutral" size="sm">
                  {tool.count} calls
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Deterministic Policy Guardrails" subtitle="Safety gates verified before recommendation">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              { rule: "EVIDENCE_CITATION_INTEGRITY", desc: "Forbids citing nonexistent evidence IDs" },
              { rule: "AUTO_RESOLVE_GUARD", desc: "Rejects auto-resolve on active exceptions" },
              { rule: "UNMATCHED_TRANSACTION_GUARD", desc: "Blocks approval when no candidate exists" },
              { rule: "MISSING_DOCUMENTATION_GUARD", desc: "Blocks approval when required invoice is absent" },
              { rule: "TIMING_DIFFERENCE_GUARD", desc: "Enforces date window policy validation" },
            ].map((p) => (
              <div
                key={p.rule}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: "var(--cp-bg-canvas-subtle)",
                }}
              >
                <div>
                  <span className="cp-mono" style={{ fontSize: "11px", fontWeight: 600 }}>
                    {p.rule}
                  </span>
                  <div style={{ fontSize: "11px", color: "var(--cp-text-tertiary)" }}>{p.desc}</div>
                </div>
                <StatusPill variant="auto_resolved" label="Active" size="sm" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Investigation Traces Summary" subtitle="Phase 6 run traces linked to review queue">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {data.transactions.map((tx) => (
            <div
              key={tx.caseId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "var(--cp-radius-sm)",
                backgroundColor: "var(--cp-bg-canvas-subtle)",
                border: "1px solid var(--cp-border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span className="cp-mono" style={{ fontWeight: 600, fontSize: "13px" }}>
                  INV-{tx.caseId}
                </span>
                <span style={{ fontSize: "13px", color: "var(--cp-text-secondary)" }}>
                  {tx.vendor} ({tx.amount})
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Badge variant={tx.riskLevel === "LOW" ? "emerald" : "amber"} size="sm">
                  Risk: {tx.riskLevel}
                </Badge>
                <StatusPill
                  variant={tx.status === "auto_resolved" ? "auto_resolved" : "human_review"}
                  label={tx.statusLabel}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
