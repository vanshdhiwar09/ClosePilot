// src/ui/App.tsx
import React, { useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { AppHeader } from "./components/layout/AppHeader";
import { NavTabId } from "./components/layout/AppSidebar";
import { HumanReviewAction, WorkflowStepId } from "./adapter/types";
import {
  startReconciliationSession,
  resetReconciliationSession,
  buildOverviewViewModel,
  getExceptionCases,
  getCaseInvestigationDetail,
  executeReviewAction,
  getEvidenceLockerViewModel,
  getClosePackageViewModel,
  SharedWorkflowState,
} from "./adapter/data-adapter";
import { StartCloseView } from "./views/StartCloseView";
import { OverviewView } from "./views/OverviewView";
import { ReconciliationView } from "./views/ReconciliationView";
import { ExceptionsView } from "./views/ExceptionsView";
import { InvestigationDetailView } from "./views/InvestigationDetailView";
import { InvestigationsView } from "./views/InvestigationsView";
import { EvidenceView } from "./views/EvidenceView";
import { ClosePackageView } from "./views/ClosePackageView";

export const App: React.FC = () => {
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [currentTab, setCurrentTab] = useState<NavTabId>("overview");
  const [sharedState, setSharedState] = useState<SharedWorkflowState | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartDemoSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await startReconciliationSession();
      setSharedState(state);
      setIsSessionStarted(true);
      setCurrentTab("overview");
      setSelectedCaseId(null);
    } catch (err: any) {
      setError(err.message || "Failed to execute reconciliation on demo dataset.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartCustomSession = async (data: Record<string, unknown>, label: string) => {
    setLoading(true);
    setError(null);
    try {
      const state = await startReconciliationSession(data, label);
      setSharedState(state);
      setIsSessionStarted(true);
      setCurrentTab("overview");
      setSelectedCaseId(null);
    } catch (err: any) {
      setError(err.message || "Failed to execute reconciliation on custom dataset.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = () => {
    resetReconciliationSession();
    setSharedState(null);
    setIsSessionStarted(false);
    setSelectedCaseId(null);
    setCurrentTab("overview");
    setError(null);
  };

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

  if (error) {
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
          Error running reconciliation workflow
        </div>
        <p style={{ color: "var(--cp-text-secondary)", fontSize: "13px" }}>{error}</p>
        <button
          onClick={handleResetSession}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--cp-radius-sm)",
            backgroundColor: "var(--cp-text-primary)",
            color: "var(--cp-text-inverted)",
            border: "none",
            cursor: "pointer",
          }}
        >
          Return to Start Screen
        </button>
      </div>
    );
  }

  if (!isSessionStarted || !sharedState) {
    return (
      <StartCloseView
        onLoadDemo={handleStartDemoSession}
        onLoadCustom={handleStartCustomSession}
        isLoading={loading}
      />
    );
  }

  const overviewData = buildOverviewViewModel(sharedState);
  const exceptionCases = getExceptionCases(sharedState);
  const openExceptionsCount = exceptionCases.filter((c) => c.reviewStatus === "REVIEW_REQUIRED").length;

  let activeStep: WorkflowStepId = "ingest";
  if (selectedCaseId) {
    activeStep = "resolve";
  } else if (currentTab === "overview") {
    activeStep = "ingest";
  } else if (currentTab === "reconciliation") {
    activeStep = "match";
  } else if (currentTab === "exceptions" || currentTab === "investigations" || currentTab === "evidence") {
    activeStep = "investigate";
  } else if (currentTab === "close-package") {
    activeStep = "report";
  }

  return (
    <AppShell
      currentTab={currentTab}
      onSelectTab={(tab) => {
        setSelectedCaseId(null);
        setCurrentTab(tab);
      }}
      periodName={overviewData.period.periodName}
      activeStep={activeStep}
      exceptionCount={openExceptionsCount}
      investigationCount={exceptionCases.length}
      evidenceCount={overviewData.financials.supportingDocumentsCount}
      onResetSession={handleResetSession}
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
          {currentTab === "reconciliation" && (
            <ReconciliationView
              onNavigate={setCurrentTab}
              summary={{
                bankTransactionsCount: overviewData.financials.bankTransactionsCount,
                ledgerEntriesCount: overviewData.financials.ledgerEntriesCount,
                autoResolvedCount: overviewData.kpis.autoResolvedCount,
                periodName: overviewData.period.periodName,
              }}
            />
          )}
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
          {currentTab === "evidence" && (
            <EvidenceView
              onNavigate={setCurrentTab}
              locker={getEvidenceLockerViewModel(sharedState)}
              onSelectCase={(id) => setSelectedCaseId(id)}
            />
          )}
          {currentTab === "close-package" && (
            <ClosePackageView
              closePackage={getClosePackageViewModel(sharedState)}
              onNavigate={setCurrentTab}
              onSelectCase={(id) => setSelectedCaseId(id)}
            />
          )}
        </>
      )}
    </AppShell>
  );
};

export default App;
