// src/ui/views/EvidenceView.tsx
import React, { useState } from "react";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { StatusPill } from "../components/primitives/StatusPill";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";
import {
  EvidenceDocumentViewModel,
  EvidenceLockerViewModel,
} from "../adapter/types";

interface EvidenceViewProps {
  onNavigate: (tab: NavTabId) => void;
  locker?: EvidenceLockerViewModel;
  documents?: EvidenceDocumentViewModel[];
  onSelectCase?: (caseId: string) => void;
}

type EvidenceTab = "all" | "documents" | "generated" | "missing";

export const EvidenceView: React.FC<EvidenceViewProps> = ({
  onNavigate,
  locker,
  documents: fallbackDocuments = [],
  onSelectCase,
}) => {
  const [activeFilter, setActiveFilter] = useState<EvidenceTab>("all");

  const documents = locker?.documents || fallbackDocuments;
  const generatedEvidence = locker?.generatedEvidence || [];
  const missingEvidenceCases = locker?.missingEvidenceCases || [];

  const totalItems = documents.length + generatedEvidence.length + missingEvidenceCases.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Supporting Evidence Locker
            </h1>
            <Badge variant="neutral" size="sm">
              {documents.length} Ingested Documents · {generatedEvidence.length} Audit Evidence
            </Badge>
          </div>
          <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px" }}>
            Evidence-linked supporting documents verified from reconciliation workflow and audit trace.
          </p>
        </div>
        <Button variant="outline" size="md" pill onClick={() => onNavigate("overview")}>
          ← Back to Overview
        </Button>
      </div>

      {/* Matching Signals Legend */}
      <Card title="Matching Signals Legend" subtitle="Four-way matching criteria evaluated by deterministic engine">
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: "Amount Match", detail: "Exact zero difference" },
            { label: "Vendor Match", detail: "Fuzzy and token normalized" },
            { label: "Reference Match", detail: "INV-XXX alphanumeric stripped" },
            { label: "Date Window", detail: "≤ 30 calendar days window" },
          ].map((sig) => (
            <div
              key={sig.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 12px",
                borderRadius: "var(--cp-radius-pill)",
                backgroundColor: "var(--cp-status-success-bg)",
                border: "1px solid var(--cp-status-success-border)",
                color: "var(--cp-status-success-text)",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <span>✓</span>
              <span>{sig.label}</span>
              <span style={{ opacity: 0.75, fontSize: "11px" }}>({sig.detail})</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--cp-border-default)",
          paddingBottom: "8px",
        }}
      >
        <button
          onClick={() => setActiveFilter("all")}
          style={{
            padding: "5px 14px",
            borderRadius: "var(--cp-radius-pill)",
            backgroundColor: activeFilter === "all" ? "var(--cp-bg-surface)" : "transparent",
            border: activeFilter === "all" ? "1px solid var(--cp-border-default)" : "1px solid transparent",
            color: activeFilter === "all" ? "var(--cp-text-primary)" : "var(--cp-text-secondary)",
            fontSize: "12px",
            fontWeight: activeFilter === "all" ? 600 : 500,
            cursor: "pointer",
            transition: "all 0.12s ease",
          }}
        >
          All Evidence ({totalItems})
        </button>
        <button
          onClick={() => setActiveFilter("documents")}
          style={{
            padding: "5px 14px",
            borderRadius: "var(--cp-radius-pill)",
            backgroundColor: activeFilter === "documents" ? "var(--cp-bg-surface)" : "transparent",
            border: activeFilter === "documents" ? "1px solid var(--cp-border-default)" : "1px solid transparent",
            color: activeFilter === "documents" ? "var(--cp-text-primary)" : "var(--cp-text-secondary)",
            fontSize: "12px",
            fontWeight: activeFilter === "documents" ? 600 : 500,
            cursor: "pointer",
            transition: "all 0.12s ease",
          }}
        >
          Supporting Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveFilter("missing")}
          style={{
            padding: "5px 14px",
            borderRadius: "var(--cp-radius-pill)",
            backgroundColor: activeFilter === "missing" ? "var(--cp-bg-surface)" : "transparent",
            border: activeFilter === "missing" ? "1px solid var(--cp-border-default)" : "1px solid transparent",
            color: activeFilter === "missing" ? "var(--cp-text-primary)" : "var(--cp-text-secondary)",
            fontSize: "12px",
            fontWeight: activeFilter === "missing" ? 600 : 500,
            cursor: "pointer",
            transition: "all 0.12s ease",
          }}
        >
          Missing Evidence ({missingEvidenceCases.length})
        </button>
        <button
          onClick={() => setActiveFilter("generated")}
          style={{
            padding: "6px 12px",
            borderRadius: "var(--cp-radius-sm)",
            backgroundColor: activeFilter === "generated" ? "var(--cp-bg-surface)" : "transparent",
            border: activeFilter === "generated" ? "1px solid var(--cp-border-default)" : "1px solid transparent",
            color: activeFilter === "generated" ? "var(--cp-text-primary)" : "var(--cp-text-secondary)",
            fontSize: "12px",
            fontWeight: activeFilter === "generated" ? 600 : 500,
            cursor: "pointer",
          }}
        >
          Generated Audit Rules ({generatedEvidence.length})
        </button>
      </div>

      {/* Section C: Missing Evidence (Honest alert section) */}
      {(activeFilter === "all" || activeFilter === "missing") && missingEvidenceCases.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--cp-status-danger-text)" }}>
              Missing Documentation Required
            </h2>
            <Badge variant="rose" size="sm">
              {missingEvidenceCases.length} Action Required
            </Badge>
          </div>
          <p style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>
            These cases have missing documentation or require evidence before human approval can be granted.
          </p>

          {missingEvidenceCases.map((miss) => (
            <Card key={miss.caseId} noPadding>
              <div
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  borderLeft: "4px solid var(--cp-status-danger-text)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "6px",
                      backgroundColor: "var(--cp-status-danger-bg)",
                      border: "1px solid var(--cp-status-danger-border)",
                      color: "var(--cp-status-danger-text)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700 }}>
                        Case {miss.caseId} ({miss.bankTxId})
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>· {miss.vendor}</span>
                      <StatusPill
                        variant={miss.status === "WAITING_FOR_EVIDENCE" ? "waiting_evidence" : "human_review"}
                        label={miss.status === "WAITING_FOR_EVIDENCE" ? "Waiting for Evidence" : "Review Required"}
                        size="sm"
                      />
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--cp-status-danger-text)", marginTop: "2px" }}>
                      {miss.reason}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span className="cp-mono" style={{ fontSize: "14px", fontWeight: 600 }}>
                    {miss.amount}
                  </span>
                  {onSelectCase && (
                    <Button variant="outline" size="sm" onClick={() => onSelectCase(miss.caseId)}>
                      Review Case →
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Section A: Supporting Documents (Real fixture documents) */}
      {(activeFilter === "all" || activeFilter === "documents") && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--cp-text-primary)" }}>
              Verified Supporting Documents
            </h2>
            <Badge variant="neutral" size="sm">
              {documents.length} Files
            </Badge>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {documents.map((doc) => (
              <Card key={doc.id} noPadding>
                <div
                  style={{
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "6px",
                        backgroundColor: "var(--cp-bg-canvas-subtle)",
                        border: "1px solid var(--cp-border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>{doc.name}</span>
                        <span
                          className="cp-mono"
                          style={{
                            fontSize: "11px",
                            backgroundColor: "var(--cp-bg-canvas-subtle)",
                            padding: "1px 5px",
                            borderRadius: "var(--cp-radius-xs)",
                            color: "var(--cp-text-secondary)",
                          }}
                        >
                          {doc.id}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--cp-text-secondary)", marginTop: "2px" }}>
                        {doc.vendor !== "General / Corporate" ? `${doc.vendor} · ` : ""}Date: {doc.date} · Linked Cases:{" "}
                        {doc.linkedCases.length > 0 ? (
                          doc.linkedCases.map((cId) => (
                            <span
                              key={cId}
                              onClick={() => onSelectCase && onSelectCase(cId)}
                              style={{
                                cursor: onSelectCase ? "pointer" : "default",
                                textDecoration: onSelectCase ? "underline" : "none",
                                marginRight: "4px",
                                color: "var(--cp-text-primary)",
                                fontWeight: 600,
                              }}
                            >
                              {cId}
                            </span>
                          ))
                        ) : (
                          "General reference"
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span className="cp-mono" style={{ fontSize: "14px", fontWeight: 600 }}>
                      {doc.amount}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {doc.type}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Section B: Generated Audit Evidence */}
      {(activeFilter === "all" || activeFilter === "generated") && generatedEvidence.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 700, color: "var(--cp-text-primary)" }}>
              Reconciliation & Investigation Audit Evidence
            </h2>
            <Badge variant="indigo" size="sm">
              {generatedEvidence.length} Verified Evidence Records
            </Badge>
          </div>
          <p style={{ fontSize: "12px", color: "var(--cp-text-secondary)" }}>
            Deterministic rule traces, anomaly threshold calculations, and source record citations created during workflow execution.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {generatedEvidence.map((ev) => {
              let badgeVariant: "emerald" | "amber" | "rose" | "indigo" | "neutral" = "neutral";
              if (ev.kind === "calculation") badgeVariant = "indigo";
              else if (ev.kind === "match_rule") badgeVariant = "emerald";
              else if (ev.kind === "missing_document") badgeVariant = "rose";

              return (
                <div
                  key={ev.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--cp-radius-sm)",
                    backgroundColor: "var(--cp-bg-surface)",
                    border: "1px solid var(--cp-border-default)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      className="cp-mono"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--cp-text-secondary)",
                      }}
                    >
                      {ev.id}
                    </span>
                    <Badge variant={badgeVariant} size="sm">
                      {ev.kind}
                    </Badge>
                    <span style={{ fontSize: "12px", color: "var(--cp-text-primary)" }}>
                      {ev.summary}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      className="cp-mono"
                      onClick={() => onSelectCase && onSelectCase(ev.caseId)}
                      style={{
                        fontSize: "11px",
                        cursor: onSelectCase ? "pointer" : "default",
                        color: "var(--cp-text-secondary)",
                        textDecoration: onSelectCase ? "underline" : "none",
                      }}
                    >
                      Case {ev.caseId}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
