// src/ui/views/ExceptionsView.tsx
import React, { useState } from "react";
import { ExceptionCaseSummary } from "../adapter/types";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { StatusPill, StatusPillVariant } from "../components/primitives/StatusPill";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";

interface ExceptionsViewProps {
  cases: ExceptionCaseSummary[];
  onSelectCase: (caseId: string) => void;
  onNavigate: (tab: NavTabId) => void;
}

export const ExceptionsView: React.FC<ExceptionsViewProps> = ({
  cases,
  onSelectCase,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const flagshipCase = cases.find((c) => c.isFlagship) || cases[0];

  const filteredCases = cases.filter((c) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        c.caseId.toLowerCase().includes(q) ||
        c.bankTxId.toLowerCase().includes(q) ||
        c.counterparty.toLowerCase().includes(q) ||
        c.reference.toLowerCase().includes(q) ||
        c.exceptionLabel.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Filter by type
    if (selectedType !== "all" && c.exceptionType !== selectedType) {
      return false;
    }

    // Filter by status
    if (selectedStatus !== "all" && c.reviewStatus !== selectedStatus) {
      return false;
    }

    return true;
  });

  const exceptionTypes = [
    { id: "all", label: "All Types" },
    { id: "potential_anomaly", label: "Potential Anomaly" },
    { id: "unmatched_transaction", label: "Unmatched" },
    { id: "amount_mismatch", label: "Amount Mismatch" },
    { id: "timing_difference", label: "Timing Diff" },
    { id: "duplicate", label: "Duplicate" },
    { id: "missing_documentation", label: "Missing Docs" },
    { id: "ambiguous", label: "Ambiguous Candidates" },
  ];

  const reviewStatuses = [
    { id: "all", label: "All Statuses" },
    { id: "REVIEW_REQUIRED", label: "Review Required" },
    { id: "WAITING_FOR_EVIDENCE", label: "Waiting for Evidence" },
    { id: "RESOLVED", label: "Resolved" },
    { id: "REJECTED", label: "Rejected" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. View Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--cp-text-primary)",
                letterSpacing: "-0.025em",
              }}
            >
              Exceptions & Human Review Queue
            </h1>
            <Badge variant="rose" size="sm">
              {cases.filter((c) => c.reviewStatus === "REVIEW_REQUIRED").length} Requiring Action
            </Badge>
          </div>
          <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px" }}>
            {cases.length} total exception{cases.length === 1 ? "" : "s"} investigated by the autonomous agent. Review agent findings, inspect evidence, and authorize resolutions.
          </p>
        </div>

        <Button variant="outline" size="md" pill onClick={() => onNavigate("overview")}>
          ← Back to Overview
        </Button>
      </div>

      {/* 2. Flagship Demo Banner — BT007 Anomaly */}
      {flagshipCase && (
        <div
          style={{
            padding: "20px 24px",
            backgroundColor: "var(--cp-bg-surface)",
            borderRadius: "var(--cp-radius-md)",
            border: "1px solid var(--cp-border-default)",
            borderLeft: "4px solid var(--cp-status-danger-text)",
            boxShadow: "var(--cp-shadow-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ maxWidth: "680px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge variant="rose" size="sm">Flagship Investigation</Badge>
              <span className="cp-mono" style={{ fontSize: "12px", fontWeight: 700, color: "var(--cp-text-primary)" }}>
                {flagshipCase.caseId} • {flagshipCase.bankTxId}
              </span>
              <Badge variant="neutral" size="sm">Ref: {flagshipCase.reference}</Badge>
              <Badge variant="amber" size="sm">Risk: {flagshipCase.riskLevel}</Badge>
            </div>

            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--cp-text-primary)", marginTop: "8px" }}>
              {flagshipCase.counterparty} — {flagshipCase.amount}
            </div>

            <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px", lineHeight: 1.4 }}>
              {flagshipCase.recommendationReason || `Statistical anomaly flagged: Expenditure exceeds account median baseline. Agent completed deep investigation with ${flagshipCase.toolCallsCount} tool executions, validated against safety policies, and escalated for controller authorization.`}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
            <Button
              variant="primary"
              size="lg"
              pill
              onClick={() => onSelectCase(flagshipCase.caseId)}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14"></path>
                  <path d="M12 5l7 7-7 7"></path>
                </svg>
              }
              iconPosition="right"
            >
              Investigate EC007 ($15,000 Anomaly)
            </Button>
            <span style={{ fontSize: "11px", color: "var(--cp-text-muted)" }}>
              Recommended: {flagshipCase.recommendationAction}
            </span>
          </div>
        </div>
      )}

      {/* 3. Filter Controls & Search */}
      <Card noPadding>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search by vendor, reference, bank tx ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: "1 1 280px",
                maxWidth: "400px",
                padding: "8px 12px",
                borderRadius: "var(--cp-radius-sm)",
                border: "1px solid var(--cp-border-default)",
                backgroundColor: "var(--cp-bg-surface)",
                fontSize: "13px",
                color: "var(--cp-text-primary)",
              }}
            />

            <div style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>
              Showing <strong>{filteredCases.length}</strong> of {cases.length} exception cases
            </div>
          </div>

          {/* Type Filter Buttons */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {exceptionTypes.map((t) => (
              <Button
                key={t.id}
                variant={selectedType === t.id ? "primary" : "ghost"}
                size="sm"
                onClick={() => setSelectedType(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          {/* Status Filter Buttons */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: "4px", borderTop: "1px solid var(--cp-border-subtle)" }}>
            {reviewStatuses.map((s) => (
              <Button
                key={s.id}
                variant={selectedStatus === s.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSelectedStatus(s.id)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* 4. Exceptions Table */}
      <Card noPadding>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--cp-bg-subtle)", borderBottom: "1px solid var(--cp-border-default)" }}>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--cp-text-secondary)" }}>Case / Tx ID</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--cp-text-secondary)" }}>Vendor & Reference</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--cp-text-secondary)" }}>Date</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--cp-text-secondary)", textAlign: "right" }}>Amount</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--cp-text-secondary)" }}>Exception Type</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--cp-text-secondary)" }}>Risk</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--cp-text-secondary)" }}>Review Status</th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--cp-text-secondary)", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => {
                let statusVariant: StatusPillVariant = "human_review";
                if (c.reviewStatus === "RESOLVED") statusVariant = "resolved";
                else if (c.reviewStatus === "REJECTED") statusVariant = "rejected";
                else if (c.reviewStatus === "WAITING_FOR_EVIDENCE") statusVariant = "waiting_evidence";

                let riskBadgeVariant: "rose" | "amber" | "emerald" | "neutral" = "rose";
                if (c.riskLevel === "LOW") riskBadgeVariant = "emerald";
                else if (c.riskLevel === "MEDIUM") riskBadgeVariant = "amber";

                return (
                  <tr
                    key={c.caseId}
                    style={{
                      borderBottom: "1px solid var(--cp-border-subtle)",
                      cursor: "pointer",
                      backgroundColor: c.isFlagship ? "rgba(168, 34, 34, 0.02)" : "transparent",
                    }}
                    onClick={() => onSelectCase(c.caseId)}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div className="cp-mono" style={{ fontWeight: 700, color: "var(--cp-text-primary)" }}>
                        {c.caseId}
                      </div>
                      <div className="cp-mono" style={{ fontSize: "11px", color: "var(--cp-text-muted)" }}>
                        {c.bankTxId}
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600, color: "var(--cp-text-primary)" }}>
                        {c.counterparty}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--cp-text-muted)" }}>
                        Ref: {c.reference}
                      </div>
                    </td>

                    <td style={{ padding: "14px 16px", color: "var(--cp-text-secondary)" }}>
                      {c.date}
                    </td>

                    <td className="cp-mono" style={{ padding: "14px 16px", fontWeight: 700, textAlign: "right", color: "var(--cp-text-primary)" }}>
                      {c.amount}
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <Badge variant={c.isFlagship ? "rose" : "neutral"} size="sm">
                        {c.exceptionLabel}
                      </Badge>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <Badge variant={riskBadgeVariant} size="sm">
                        {c.riskLevel}
                      </Badge>
                    </td>

                    <td style={{ padding: "14px 16px" }}>
                      <StatusPill variant={statusVariant} label={c.reviewStatusLabel} size="sm" />
                    </td>

                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCase(c.caseId);
                        }}
                      >
                        Investigate →
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
