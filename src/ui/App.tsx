// src/ui/App.tsx
import React, { useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { NavTabId } from "./components/layout/AppSidebar";
import { OverviewDataViewModel } from "./adapter/types";
import { loadOverviewData } from "./adapter/data-adapter";
import { OverviewView } from "./views/OverviewView";
import { ReconciliationView } from "./views/ReconciliationView";
import { ExceptionsView } from "./views/ExceptionsView";
import { InvestigationsView } from "./views/InvestigationsView";
import { EvidenceView } from "./views/EvidenceView";
import { ClosePackageView } from "./views/ClosePackageView";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTabId>("overview");
  const [data, setData] = useState<OverviewDataViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadOverviewData()
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to load reconciliation overview data.");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--cp-bg-canvas)",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            backgroundColor: "var(--cp-text-primary)",
            color: "var(--cp-text-inverted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "spin 1.5s linear infinite",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </div>
        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--cp-text-secondary)" }}>
          Initializing ClosePilot Reconciliation Engine...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--cp-bg-canvas)",
          gap: "16px",
          padding: "24px",
        }}
      >
        <div style={{ color: "var(--cp-status-danger-text)", fontSize: "16px", fontWeight: 600 }}>
          Error loading ClosePilot workspace
        </div>
        <p style={{ color: "var(--cp-text-secondary)", fontSize: "13px" }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--cp-radius-sm)",
            backgroundColor: "var(--cp-text-primary)",
            color: "var(--cp-text-inverted)",
            border: "none",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <AppShell
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      periodName={data.period.periodName}
      activeStep={data.period.activeStep}
      exceptionCount={data.kpis.humanReviewCount}
      investigationCount={data.kpis.humanReviewCount}
      evidenceCount={data.financials.supportingDocumentsCount}
    >
      {currentTab === "overview" && <OverviewView data={data} onNavigate={setCurrentTab} />}
      {currentTab === "reconciliation" && <ReconciliationView onNavigate={setCurrentTab} />}
      {currentTab === "exceptions" && <ExceptionsView data={data} onNavigate={setCurrentTab} />}
      {currentTab === "investigations" && <InvestigationsView data={data} onNavigate={setCurrentTab} />}
      {currentTab === "evidence" && <EvidenceView onNavigate={setCurrentTab} />}
      {currentTab === "close-package" && <ClosePackageView data={data} onNavigate={setCurrentTab} />}
    </AppShell>
  );
};

export default App;

