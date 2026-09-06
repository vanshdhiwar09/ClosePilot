// src/ui/views/ExceptionsView.tsx
import React from "react";
import { OverviewDataViewModel } from "../adapter/types";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { StatusPill } from "../components/primitives/StatusPill";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";

interface ExceptionsViewProps {
  data: OverviewDataViewModel;
  onNavigate: (tab: NavTabId) => void;
}

export const ExceptionsView: React.FC<ExceptionsViewProps> = ({ data, onNavigate }) => {
  const exceptionCases = data.transactions.filter((t) => t.status === "human_review");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Exceptions Review Queue
            </h1>
            <Badge variant="rose" size="sm">
              7 Active Exceptions
            </Badge>
          </div>
          <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px" }}>
            All 7 cases require human oversight per accounting policy. Autonomous agent recommendations
            and evidence citations are prepared.
          </p>
        </div>
        <Button variant="outline" size="md" onClick={() => onNavigate("overview")}>
          ← Back to Overview
        </Button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {exceptionCases.map((ec) => (
          <Card key={ec.caseId} noPadding>
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "15px", fontWeight: 600 }}>{ec.caseId}</span>
                  <span className="cp-mono" style={{ fontSize: "12px", color: "var(--cp-text-tertiary)" }}>
                    {ec.bankTxId}
                  </span>
                </div>

                <div style={{ height: "28px", width: "1px", backgroundColor: "var(--cp-border-default)" }} />

                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600 }}>{ec.vendor}</span>
                    <span
                      className="cp-mono"
                      style={{
                        fontSize: "11px",
                        backgroundColor: "var(--cp-bg-canvas-subtle)",
                        padding: "1px 6px",
                        borderRadius: "var(--cp-radius-xs)",
                        border: "1px solid var(--cp-border-subtle)",
                      }}
                    >
                      {ec.reference}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--cp-text-secondary)", marginTop: "2px" }}>
                    Date: {ec.date} · Evidence items: {ec.evidenceCount}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ textAlign: "right" }}>
                  <div className="cp-mono" style={{ fontSize: "16px", fontWeight: 700 }}>
                    {ec.amount}
                  </div>
                  <Badge
                    variant={ec.exceptionType === "timing_difference" ? "amber" : "rose"}
                    size="sm"
                  >
                    {ec.exceptionLabel}
                  </Badge>
                </div>

                <StatusPill variant="human_review" label="Review Required" size="sm" />

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigate("investigations")}
                >
                  Inspect Agent Run →
                </Button>
              </div>
            </div>

            {ec.recommendationReason && (
              <div
                style={{
                  padding: "10px 20px",
                  backgroundColor: "var(--cp-bg-canvas-subtle)",
                  borderTop: "1px solid var(--cp-border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 600, color: "var(--cp-status-info-text)" }}>
                    Agent Recommendation:
                  </span>
                  <span style={{ color: "var(--cp-text-secondary)" }}>{ec.recommendationReason}</span>
                </div>
                <Badge variant="neutral" size="sm">
                  Risk: {ec.riskLevel}
                </Badge>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
