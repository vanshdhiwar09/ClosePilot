// src/ui/App.tsx
import React, { useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { NavTabId } from "./components/layout/AppSidebar";
import { HumanReviewAction } from "./adapter/types";
import {
  getWorkflowState,
  buildOverviewViewModel,
  getExceptionCases,
  getCaseInvestigationDetail,
  executeReviewAction,
  SharedWorkflowState,
} from "./adapter/data-adapter";
import { OverviewView } from "./views/OverviewView";
import { ReconciliationView } from "./views/ReconciliationView";
import { ExceptionsView } from "./views/ExceptionsView";
import { InvestigationDetailView } from "./views/InvestigationDetailView";
import { InvestigationsView } from "./views/InvestigationsView";
import { EvidenceView } from "./views/EvidenceView";
import { ClosePackageView } from "./views/ClosePackageView";

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTabId>("overview");
  const [sharedState, setSharedState] = useState<SharedWorkflowState | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getWorkflowState()
      .then((state) => {
        if (mounted) {
          setSharedState(state);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to initialize ClosePilot reconciliation workspace.");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleApplyAction = async (
    caseId: string,
    action: HumanReviewAction,
    reason: string
  ) => {
    if (!sharedState) return;

    // Call pure domain state machine and regenerate close package
    executeReviewAction(sharedState, {
      caseId,
      action,
      reason,
    });

    // Bump version to trigger reactive re-render of view models
    setVersion((v) => v + 1);
  };

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
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
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

  if (error || !sharedState) {
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

  const overviewData = buildOverviewViewModel(sharedState);
  const exceptionCases = getExceptionCases(sharedState);
  const openExceptionsCount = exceptionCases.filter((c) => c.reviewStatus === "REVIEW_REQUIRED").length;

  return (
    <AppShell
      currentTab={currentTab}
      onSelectTab={(tab) => {
        setSelectedCaseId(null);
        setCurrentTab(tab);
      }}
      periodName={overviewData.period.periodName}
      activeStep={selectedCaseId ? "resolve" : overviewData.period.activeStep}
      exceptionCount={openExceptionsCount}
      investigationCount={exceptionCases.length}
      evidenceCount={overviewData.financials.supportingDocumentsCount}
    >
      {selectedCaseId ? (
        <InvestigationDetailView
          caseDetail={getCaseInvestigationDetail(sharedState, selectedCaseId)}
          onBack={() => setSelectedCaseId(null)}
          onApplyAction={handleApplyAction}
        />
      ) : (
        <>
          {currentTab === "overview" && (
            <OverviewView
              data={overviewData}
              onNavigate={setCurrentTab}
              onSelectCase={(id) => {
                setSelectedCaseId(id);
              }}
            />
          )}
          {currentTab === "reconciliation" && <ReconciliationView onNavigate={setCurrentTab} />}
          {currentTab === "exceptions" && (
            <ExceptionsView
              cases={exceptionCases}
              onSelectCase={(id) => setSelectedCaseId(id)}
              onNavigate={setCurrentTab}
            />
          )}
          {currentTab === "investigations" && (
            <InvestigationsView
              cases={exceptionCases}
              onSelectCase={(id) => setSelectedCaseId(id)}
              onNavigate={setCurrentTab}
            />
          )}
          {currentTab === "evidence" && <EvidenceView onNavigate={setCurrentTab} />}
          {currentTab === "close-package" && <ClosePackageView data={overviewData} onNavigate={setCurrentTab} />}
        </>
      )}
    </AppShell>
  );
};

export default App;
