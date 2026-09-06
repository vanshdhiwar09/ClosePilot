// src/ui/views/ClosePackageView.tsx
import React from "react";
import { OverviewDataViewModel } from "../adapter/types";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { StatusPill } from "../components/primitives/StatusPill";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";

interface ClosePackageViewProps {
  data: OverviewDataViewModel;
  onNavigate: (tab: NavTabId) => void;
}

export const ClosePackageView: React.FC<ClosePackageViewProps> = ({ data, onNavigate }) => {
  const { financials, kpis } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Evidence-Backed Close Package
            </h1>
            <Badge variant="amber" size="sm">
              In Progress
            </Badge>
          </div>
          <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px" }}>
            Audit-ready close package generated deterministically from session state and human review decisions.
          </p>
        </div>
        <Button variant="outline" size="md" onClick={() => onNavigate("overview")}>
          ← Back to Overview
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}
      >
        <Card title="Close Package Metadata" subtitle="Evidence-linked to period 2024.1">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Accounting Period:</span>
              <span className="cp-mono" style={{ fontWeight: 600 }}>
                {data.period.periodName} ({data.period.periodId})
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Engine Version:</span>
              <span className="cp-mono" style={{ fontWeight: 600 }}>
                0.1.0 (Deterministic Core)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Audit Traceability:</span>
              <Badge variant="emerald" size="sm">
                Evidence-Linked
              </Badge>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Package Status:</span>
              <StatusPill variant="human_review" label="Awaiting Human Review" size="sm" />
            </div>
          </div>
        </Card>

        <Card title="Financial Closure Summary" subtitle="Derived directly from ClosePackage.summary">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Total Cases:</span>
              <span className="cp-mono" style={{ fontWeight: 600 }}>
                {kpis.totalCases}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Reconciled Balance:</span>
              <span className="cp-mono" style={{ fontWeight: 700, color: "var(--cp-status-success-text)" }}>
                {financials.totalReconciledAmount} (1 Case)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Unreconciled Balance:</span>
              <span className="cp-mono" style={{ fontWeight: 700, color: "var(--cp-status-warning-text)" }}>
                {financials.totalUnreconciledAmount} (7 Cases)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>All Cases Closed:</span>
              <span style={{ fontWeight: 500, color: "var(--cp-status-danger-text)" }}>
                No (Requires 7 human review decisions)
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
