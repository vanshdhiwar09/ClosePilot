// src/ui/views/ClosePackageView.tsx
import React, { useState } from "react";
import { ClosePackageViewModel, CaseCloseRecordViewModel } from "../adapter/types";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { StatusPill } from "../components/primitives/StatusPill";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";

interface ClosePackageViewProps {
  closePackage: ClosePackageViewModel;
  onNavigate: (tab: NavTabId) => void;
  onSelectCase?: (caseId: string) => void;
}

export const ClosePackageView: React.FC<ClosePackageViewProps> = ({
  closePackage,
  onNavigate,
  onSelectCase,
}) => {
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [showMarkdownModal, setShowMarkdownModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    packageId,
    period,
    workflowVersion,
    engineVersion,
    environment,
    generatedAt,
    allCasesClosed,
    totalCases,
    automaticallyResolvedCases,
    humanReviewedCases,
    approvedCases,
    rejectedCases,
    unresolvedCases,
    totalReconciledAmount,
    totalUnreconciledAmount,
    exceptionCounts,
    cases,
    markdownReport,
  } = closePackage;

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Evidence-Backed Close Package
            </h1>
            <Badge variant={allCasesClosed ? "emerald" : "amber"} size="sm">
              {allCasesClosed ? "Fully Closed" : "Pending Review Decisions"}
            </Badge>
          </div>
          <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px" }}>
            Deterministic month-end close package derived from reconciliation results, agent investigations, and human decisions.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="primary" size="md" pill onClick={() => setShowMarkdownModal(true)}>
            View Audit Markdown Report
          </Button>
          <Button variant="outline" size="md" pill onClick={() => onNavigate("overview")}>
            ← Back to Overview
          </Button>
        </div>
      </div>

      {/* 2. Top Metadata Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "16px" }}>
        <Card title="Package Metadata & Traceability" subtitle={`Evidence-linked to period ${period}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Package ID:</span>
              <span className="cp-mono" style={{ fontWeight: 600 }}>{packageId}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Accounting Period:</span>
              <span className="cp-mono" style={{ fontWeight: 600 }}>{period}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Engine Version:</span>
              <span className="cp-mono" style={{ fontWeight: 600 }}>
                {engineVersion} ({environment})
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Workflow Spec:</span>
              <span className="cp-mono" style={{ fontWeight: 600 }}>v{workflowVersion}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Generated Timestamp:</span>
              <span className="cp-mono" style={{ fontSize: "12px" }}>{generatedAt}</span>
            </div>
          </div>
        </Card>

        <Card title="Financial Closure Summary" subtitle="Derived directly from ClosePackage.summary">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Total Reconciliation Cases:</span>
              <span className="cp-mono" style={{ fontWeight: 600 }}>{totalCases}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Reconciled Balance:</span>
              <span className="cp-mono" style={{ fontWeight: 700, color: "var(--cp-status-success-text)" }}>
                {totalReconciledAmount} ({automaticallyResolvedCases + approvedCases} Cases Closed)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Unreconciled Balance:</span>
              <span className="cp-mono" style={{ fontWeight: 700, color: unresolvedCases > 0 ? "var(--cp-status-warning-text)" : "var(--cp-text-primary)" }}>
                {totalUnreconciledAmount} ({unresolvedCases} Unresolved)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Review Status:</span>
              <span style={{ fontWeight: 600 }}>
                {humanReviewedCases} reviewed · {approvedCases} approved · {rejectedCases} rejected
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--cp-text-secondary)" }}>Close Condition:</span>
              <span style={{ fontWeight: 600, color: allCasesClosed ? "var(--cp-status-success-text)" : "var(--cp-status-danger-text)" }}>
                {allCasesClosed ? "All Cases Closed & Reconciled" : `Open (${unresolvedCases} human reviews remaining)`}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Exception Breakdown */}
      <Card title="Exception Distribution" subtitle="All exceptions detected across cases in this period">
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {Object.entries(exceptionCounts).map(([type, count]) => (
            <div
              key={type}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "var(--cp-radius-sm)",
                backgroundColor: "var(--cp-bg-surface)",
                border: "1px solid var(--cp-border-default)",
                fontSize: "12px",
              }}
            >
              <span style={{ color: "var(--cp-text-secondary)" }}>
                {type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}:
              </span>
              <span className="cp-mono" style={{ fontWeight: 700 }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* 4. Case-by-Case Close Ledger */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700 }}>Case-by-Case Close Ledger & Audit Traceability</h2>
          <span style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>
            Click any row to inspect investigation details, policy validation, and decision history.
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {cases.map((c) => {
            const isExpanded = expandedCaseId === c.caseId;

            let statusPillVariant: "resolved" | "human_review" | "rejected" = "human_review";
            let statusLabel = "Unresolved";
            if (c.finalStatus === "closed") {
              statusPillVariant = "resolved";
              statusLabel = "Closed";
            } else if (c.finalStatus === "rejected") {
              statusPillVariant = "rejected";
              statusLabel = "Rejected";
            }

            return (
              <Card key={c.caseId} noPadding>
                <div>
                  <div
                    onClick={() => setExpandedCaseId(isExpanded ? null : c.caseId)}
                    style={{
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      backgroundColor: isExpanded ? "var(--cp-bg-canvas-subtle)" : "var(--cp-bg-surface)",
                      transition: "background-color 0.12s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span
                        className="cp-mono"
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--cp-text-primary)",
                          minWidth: "60px",
                        }}
                      >
                        {c.caseId}
                      </span>
                      <span className="cp-mono" style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>
                        {c.bankTransactionId}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{c.vendor}</span>
                      <span style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>{c.date}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span className="cp-mono" style={{ fontSize: "14px", fontWeight: 700 }}>
                        {c.amount}
                      </span>
                      <StatusPill variant={statusPillVariant} label={statusLabel} size="sm" />
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--cp-text-secondary)",
                          transform: isExpanded ? "rotate(180deg)" : "none",
                          transition: "transform 0.15s ease",
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* Closure Reason bar */}
                  <div
                    style={{
                      padding: "6px 18px",
                      borderTop: "1px solid var(--cp-border-subtle)",
                      fontSize: "12px",
                      color: "var(--cp-text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500 }}>Closure Reason: </span>
                      <span>{c.closureReason}</span>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <span>Evidence: {c.evidenceIds.length} items</span>
                      <span>Decisions: {c.decisionCount}</span>
                    </div>
                  </div>

                  {/* Expanded Audit Trace */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: "16px 18px",
                        borderTop: "1px solid var(--cp-border-default)",
                        backgroundColor: "var(--cp-bg-surface)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        fontSize: "13px",
                      }}
                    >
                      {/* Investigation Summary if available */}
                      {c.investigationSummary && (
                        <div
                          style={{
                            padding: "12px 14px",
                            borderRadius: "var(--cp-radius-sm)",
                            backgroundColor: "var(--cp-bg-canvas-subtle)",
                            border: "1px solid var(--cp-border-subtle)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontWeight: 700 }}>Autonomous Investigation:</span>
                              <Badge variant="indigo" size="sm">
                                {c.investigationSummary.outcome}
                              </Badge>
                              <Badge variant="neutral" size="sm">
                                Risk: {c.investigationSummary.riskLevel}
                              </Badge>
                            </div>
                            <span className="cp-mono" style={{ fontSize: "11px", color: "var(--cp-text-secondary)" }}>
                              {c.investigationSummary.investigationId}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: "var(--cp-text-secondary)" }}>Root Cause: </span>
                            <span>{c.investigationSummary.rootCause}</span>
                          </div>
                          <div>
                            <span style={{ color: "var(--cp-text-secondary)" }}>Recommendation: </span>
                            <span className="cp-mono" style={{ fontWeight: 600 }}>
                              {c.investigationSummary.recommendationAction}
                            </span>{" "}
                            — {c.investigationSummary.recommendationReason}
                          </div>
                          <div style={{ marginTop: "4px" }}>
                            <span style={{ color: "var(--cp-text-secondary)" }}>Policy Validation: </span>
                            <Badge
                              variant={c.investigationSummary.isPermitted ? "emerald" : "rose"}
                              size="sm"
                            >
                              {c.investigationSummary.isPermitted ? "Permitted" : "Forced Human Review"}
                            </Badge>{" "}
                            <span className="cp-mono" style={{ fontSize: "11px" }}>
                              {c.investigationSummary.policyRule}
                            </span>{" "}
                            ({c.investigationSummary.policyReason})
                          </div>
                        </div>
                      )}

                      {/* Human Review Decision History */}
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: "6px" }}>
                          Human Review Decision History ({c.decisionHistory.length})
                        </div>
                        {c.decisionHistory.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {c.decisionHistory.map((d) => (
                              <div
                                key={d.id}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: "var(--cp-radius-xs)",
                                  backgroundColor: "var(--cp-bg-canvas-subtle)",
                                  border: "1px solid var(--cp-border-subtle)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  fontSize: "12px",
                                }}
                              >
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--cp-text-primary)" }}>
                                    {d.action}
                                  </span>{" "}
                                  by <span style={{ fontWeight: 600 }}>{d.reviewerName}</span> ({d.reviewerRole}) —{" "}
                                  <em>"{d.reason}"</em>
                                </div>
                                <span className="cp-mono" style={{ color: "var(--cp-text-secondary)", fontSize: "11px" }}>
                                  {d.timestamp}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>
                            {c.isClosed
                              ? "Auto-reconciled under deterministic exact matching rule (no human intervention needed)."
                              : `Awaiting human review: ${c.outstandingRequirements.join("; ")}`}
                          </div>
                        )}
                      </div>

                      {/* Evidence Citations & Jump Action */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "6px" }}>
                        <div style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>
                          <span style={{ fontWeight: 600 }}>Evidence Citations: </span>
                          <span className="cp-mono">{c.evidenceIds.join(", ")}</span>
                        </div>

                        {onSelectCase && (
                          <Button variant="outline" size="sm" onClick={() => onSelectCase(c.caseId)}>
                            Open Case Detail →
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 5. Full Audit Markdown Modal */}
      {showMarkdownModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "24px",
          }}
          onClick={() => setShowMarkdownModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--cp-bg-surface)",
              borderRadius: "var(--cp-radius-md)",
              border: "1px solid var(--cp-border-default)",
              boxShadow: "var(--cp-shadow-lg)",
              maxWidth: "850px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--cp-border-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700 }}>Audit-Ready Close Package (Markdown)</h3>
                <p style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>
                  Standard exportable month-end audit ledger formatted for finance and audit compliance.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="primary" size="sm" onClick={handleCopyMarkdown}>
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowMarkdownModal(false)}>
                  ✕ Close
                </Button>
              </div>
            </div>

            <div
              style={{
                padding: "20px",
                overflowY: "auto",
                flex: 1,
                fontSize: "12px",
                lineHeight: 1.5,
              }}
            >
              <pre
                className="cp-mono"
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "var(--cp-font-mono)",
                  color: "var(--cp-text-primary)",
                  backgroundColor: "var(--cp-bg-canvas-subtle)",
                  padding: "16px",
                  borderRadius: "var(--cp-radius-sm)",
                  border: "1px solid var(--cp-border-subtle)",
                }}
              >
                {markdownReport}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
