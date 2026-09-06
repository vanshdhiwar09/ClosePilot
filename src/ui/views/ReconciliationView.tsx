// src/ui/views/ReconciliationView.tsx
import React from "react";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";

interface ReconciliationViewProps {
  onNavigate: (tab: NavTabId) => void;
  summary?: {
    bankTransactionsCount: number;
    ledgerEntriesCount: number;
    autoResolvedCount: number;
    periodName?: string;
  };
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({ onNavigate, summary }) => {
  const bankCount = summary?.bankTransactionsCount ?? 8;
  const ledgerCount = summary?.ledgerEntriesCount ?? 10;
  const autoCount = summary?.autoResolvedCount ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Deterministic Reconciliation Engine
          </h1>
          <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px" }}>
            Pipeline status: Ingested {bankCount} bank transaction{bankCount === 1 ? "" : "s"} and {ledgerCount} ledger entr{ledgerCount === 1 ? "y" : "ies"}. {autoCount} exact match{autoCount === 1 ? "" : "es"} auto-reconciled.
          </p>
        </div>
        <Button variant="outline" size="md" pill onClick={() => onNavigate("overview")}>
          ← Back to Overview
        </Button>
      </div>

      <Card title="Deterministic Matching Rules Active" subtitle="Source of truth accounting layer">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            {
              rule: "exact_match_rule",
              desc: "Matches exact amount, currency, and normalized invoice reference within 0 date days.",
              status: "Active (exact candidate match)",
              variant: "emerald" as const,
            },
            {
              rule: "timing_difference_rule",
              desc: "Detects amount & reference match with date variance (up to 30 calendar days).",
              status: "Active (date tolerance window)",
              variant: "amber" as const,
            },
            {
              rule: "duplicate_detection_rule",
              desc: "Flags potential multiple postings sharing identical amounts, dates, or vendor tokens.",
              status: "Active (candidate duplicate cluster)",
              variant: "rose" as const,
            },
            {
              rule: "missing_documentation_guard",
              desc: "Enforces invoice/receipt proof before approval for corporate transactions.",
              status: "Active (documentation required)",
              variant: "rose" as const,
            },
          ].map((r) => (
            <div
              key={r.rule}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderRadius: "var(--cp-radius-sm)",
                backgroundColor: "var(--cp-bg-canvas-subtle)",
                border: "1px solid var(--cp-border-subtle)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="cp-mono" style={{ fontWeight: 600, fontSize: "13px" }}>
                    {r.rule}
                  </span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--cp-text-secondary)", marginTop: "2px" }}>
                  {r.desc}
                </p>
              </div>
              <Badge variant={r.variant} size="sm">
                {r.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
