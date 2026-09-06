// src/ui/views/OverviewView.tsx
import React from "react";
import { OverviewDataViewModel } from "../adapter/types";
import { MetricCard } from "../components/primitives/MetricCard";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { StatusPill } from "../components/primitives/StatusPill";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";

interface OverviewViewProps {
  data: OverviewDataViewModel;
  onNavigate: (tab: NavTabId) => void;
  onSelectCase?: (caseId: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ data, onNavigate, onSelectCase }) => {
  const { kpis, financials, exceptionsDistribution, transactions } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Page Header & Operational Status Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
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
              Month-End Reconciliation Overview
            </h1>
            <Badge variant="amber" size="sm">
              Action Required
            </Badge>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--cp-text-secondary)",
              marginTop: "4px",
            }}
          >
            Autonomous investigation agent active for period {data.period.periodName}. 1 case
            auto-resolved; 7 exceptions investigated and prepared for human review.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Button variant="outline" size="md" onClick={() => onNavigate("close-package")}>
            View Close Package
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigate("exceptions")}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14"></path>
                <path d="M12 5l7 7-7 7"></path>
              </svg>
            }
            iconPosition="right"
          >
            Review Exceptions (7)
          </Button>
        </div>
      </div>

      {/* 2. Primary KPI Grid — Strictly Verified Backend Domain Figures */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        <MetricCard
          label="Agreement Accuracy"
          value={kpis.agreementAccuracy}
          detail={kpis.agreementDetail}
          badgeText={`${kpis.agreementAccuracy} Fidelity`}
          badgeVariant={kpis.agreementAccuracy === "100.0%" ? "emerald" : "amber"}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          }
        />

        <MetricCard
          label="False Auto-Close"
          value={kpis.falseAutoCloseRate}
          detail="Zero incorrect closures (safety guard)"
          badgeText="Safe"
          badgeVariant="emerald"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          }
        />

        <MetricCard
          label="Auto-Resolved (Exact)"
          value={kpis.autoResolvedCount}
          detail={`${kpis.autoResolvedAmount} baseline reconciled`}
          badgeText="1 Case"
          badgeVariant="neutral"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          }
        />

        <MetricCard
          label="Human Review Load"
          value={kpis.humanReviewRatio}
          detail="7 cases require human approval"
          badgeText="Policy Required"
          badgeVariant="amber"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          }
        />
      </div>

      {/* 3. Reconciled vs Unreconciled Balance & Exception Categories */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr",
          gap: "16px",
        }}
      >
        {/* Balance Status Card */}
        <Card
          title="Accounting Period Balance Status"
          subtitle="Baseline amounts derived directly from close-package summary"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: "var(--cp-status-success-bg)",
                  border: "1px solid var(--cp-status-success-border)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--cp-status-success-text)",
                  }}
                >
                  Reconciled (Closed)
                </div>
                <div
                  className="cp-mono"
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "var(--cp-status-success-text)",
                    marginTop: "4px",
                  }}
                >
                  {financials.totalReconciledAmount}
                </div>
                <div style={{ fontSize: "11px", color: "var(--cp-status-success-text)", marginTop: "2px" }}>
                  1 Auto-Resolved Exact Match
                </div>
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: "var(--cp-status-warning-bg)",
                  border: "1px solid var(--cp-status-warning-border)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--cp-status-warning-text)",
                  }}
                >
                  Unreconciled (Open)
                </div>
                <div
                  className="cp-mono"
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "var(--cp-status-warning-text)",
                    marginTop: "4px",
                  }}
                >
                  {financials.totalUnreconciledAmount}
                </div>
                <div style={{ fontSize: "11px", color: "var(--cp-status-warning-text)", marginTop: "2px" }}>
                  7 Cases Under Human Review
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: "var(--cp-radius-sm)",
                backgroundColor: "var(--cp-bg-canvas-subtle)",
                border: "1px solid var(--cp-border-subtle)",
                fontSize: "12px",
                color: "var(--cp-text-secondary)",
              }}
            >
              <span>Records Processed:</span>
              <span className="cp-mono" style={{ fontWeight: 600, color: "var(--cp-text-primary)" }}>
                {financials.bankTransactionsCount} Bank Tx · {financials.ledgerEntriesCount} Ledger Entries ·{" "}
                {financials.supportingDocumentsCount} Documents
              </span>
            </div>
          </div>
        </Card>

        {/* Active Exceptions Breakdown */}
        <Card
          title="Active Exception Distribution"
          subtitle="Classified by deterministic matching pipeline"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigate("exceptions")}>
              View All →
            </Button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {exceptionsDistribution.map((item) => (
              <div
                key={item.type}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "var(--cp-radius-sm)",
                  backgroundColor: "var(--cp-bg-canvas-subtle)",
                  border: "1px solid var(--cp-border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor:
                        item.badgeVariant === "rose"
                          ? "var(--cp-status-danger-dot)"
                          : item.badgeVariant === "amber"
                          ? "var(--cp-status-warning-dot)"
                          : "var(--cp-status-neutral-text)",
                    }}
                  />
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--cp-text-primary)" }}>
                    {item.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Badge variant={item.badgeVariant} size="sm">
                    {item.count} Case{item.count > 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 4. Complete Case Inventory Table (Real Fixture Transactions) */}
      <Card
        title="Month-End Reconciliation Cases (8)"
        subtitle="Full deterministic record set from 2024.1 fixture"
        noPadding
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--cp-bg-canvas-subtle)",
                  borderBottom: "1px solid var(--cp-border-default)",
                  color: "var(--cp-text-secondary)",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <th style={{ padding: "12px 16px" }}>Case / Tx ID</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Vendor / Description</th>
                <th style={{ padding: "12px 16px" }}>Reference</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount</th>
                <th style={{ padding: "12px 16px" }}>Exception Finding</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, idx) => (
                <tr
                  key={tx.caseId}
                  style={{
                    borderBottom:
                      idx < transactions.length - 1 ? "1px solid var(--cp-border-subtle)" : "none",
                    backgroundColor: idx % 2 === 0 ? "var(--cp-bg-surface)" : "var(--cp-bg-canvas)",
                    transition: "background-color 0.1s ease",
                    cursor: tx.status === "human_review" ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (tx.status === "human_review" && onSelectCase) {
                      onSelectCase(tx.caseId);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--cp-bg-surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      idx % 2 === 0 ? "var(--cp-bg-surface)" : "var(--cp-bg-canvas)";
                  }}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 600, color: "var(--cp-text-primary)" }}>{tx.caseId}</span>
                      <span className="cp-mono" style={{ fontSize: "11px", color: "var(--cp-text-tertiary)" }}>
                        {tx.bankTxId}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className="cp-mono" style={{ color: "var(--cp-text-secondary)" }}>
                      {tx.date}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontWeight: 500, color: "var(--cp-text-primary)" }}>{tx.vendor}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      className="cp-mono"
                      style={{
                        fontSize: "12px",
                        backgroundColor: "var(--cp-bg-canvas-subtle)",
                        padding: "2px 6px",
                        borderRadius: "var(--cp-radius-xs)",
                        border: "1px solid var(--cp-border-subtle)",
                      }}
                    >
                      {tx.reference}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <span
                      className="cp-mono"
                      style={{
                        fontWeight: 600,
                        color: "var(--cp-text-primary)",
                      }}
                    >
                      {tx.amount}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {tx.exceptionType ? (
                      <Badge
                        variant={
                          tx.exceptionType === "timing_difference"
                            ? "amber"
                            : "rose"
                        }
                        size="sm"
                      >
                        {tx.exceptionLabel}
                      </Badge>
                    ) : (
                      <Badge variant="emerald" size="sm">
                        None (Exact Match)
                      </Badge>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusPill
                      variant={tx.status === "auto_resolved" ? "auto_resolved" : "human_review"}
                      label={tx.statusLabel}
                      size="sm"
                    />
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <Button
                      variant={tx.status === "auto_resolved" ? "ghost" : "outline"}
                      size="sm"
                      onClick={() => onNavigate(tx.status === "auto_resolved" ? "reconciliation" : "exceptions")}
                    >
                      {tx.status === "auto_resolved" ? "Inspect" : "Review"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
