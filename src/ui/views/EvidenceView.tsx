// src/ui/views/EvidenceView.tsx
import React from "react";
import { Card } from "../components/primitives/Card";
import { Badge } from "../components/primitives/Badge";
import { Button } from "../components/primitives/Button";
import { NavTabId } from "../components/layout/AppSidebar";

interface EvidenceViewProps {
  onNavigate: (tab: NavTabId) => void;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({ onNavigate }) => {
  const documents = [
    {
      id: "SD001",
      name: "invoice-vendor-a-001.pdf",
      vendor: "Vendor A",
      amount: "$1,250.00",
      date: "2024-01-15",
      type: "invoice",
      linkedCases: ["EC001", "EC004"],
    },
    {
      id: "SD002",
      name: "invoice-vendor-b-002.pdf",
      vendor: "Vendor B",
      amount: "$1,850.00",
      date: "2024-01-12",
      type: "invoice",
      linkedCases: ["EC002"],
    },
    {
      id: "SD004",
      name: "invoice-vendor-c-004.pdf",
      vendor: "Vendor C",
      amount: "$3,100.00",
      date: "2024-01-18",
      type: "invoice",
      linkedCases: ["EC005"],
    },
    {
      id: "SD005",
      name: "invoice-vendor-d-005.pdf",
      vendor: "Vendor D",
      amount: "$15,000.00",
      date: "2024-01-20",
      type: "contract_receipt",
      linkedCases: ["EC007"],
    },
    {
      id: "SD006",
      name: "invoice-vendor-e-006.pdf",
      vendor: "Vendor E",
      amount: "$2,400.00",
      date: "2024-01-22",
      type: "invoice",
      linkedCases: ["EC008"],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Supporting Evidence Locker
            </h1>
            <Badge variant="neutral" size="sm">
              5 Ingested Documents
            </Badge>
          </div>
          <p style={{ fontSize: "13px", color: "var(--cp-text-secondary)", marginTop: "4px" }}>
            Cryptographically verified supporting documents linked to reconciliation exceptions.
          </p>
        </div>
        <Button variant="outline" size="md" onClick={() => onNavigate("overview")}>
          ← Back to Overview
        </Button>
      </div>

      {/* Matching Signals Legend matching visual reference */}
      <Card title="Matching Signals Legend" subtitle="Four-way matching criteria evaluated by engine">
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
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
                padding: "6px 12px",
                borderRadius: "var(--cp-radius-sm)",
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

      {/* Documents List */}
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
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{doc.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--cp-text-secondary)" }}>
                    {doc.vendor} · Date: {doc.date} · Linked Cases: {doc.linkedCases.join(", ")}
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
  );
};
