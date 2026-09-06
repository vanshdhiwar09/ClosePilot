// src/ui/components/layout/AppShell.tsx
import React from "react";
import { AppHeader } from "./AppHeader";
import { AppSidebar, NavTabId } from "./AppSidebar";
import { WorkflowStepId } from "../../adapter/types";

interface AppShellProps {
  children: React.ReactNode;
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  periodName?: string;
  activeStep?: WorkflowStepId;
  exceptionCount?: number;
  investigationCount?: number;
  evidenceCount?: number;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentTab,
  onSelectTab,
  periodName,
  activeStep,
  exceptionCount,
  investigationCount,
  evidenceCount,
}) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--cp-bg-canvas)",
      }}
    >
      <AppHeader periodName={periodName} activeStep={activeStep} />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <AppSidebar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          exceptionCount={exceptionCount}
          investigationCount={investigationCount}
          evidenceCount={evidenceCount}
        />

        <main
          style={{
            flex: 1,
            padding: "24px 32px 48px 32px",
            overflowY: "auto",
            maxWidth: "1440px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
