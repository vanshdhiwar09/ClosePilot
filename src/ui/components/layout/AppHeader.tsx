// src/ui/components/layout/AppHeader.tsx
import React from "react";
import { WorkflowStepper } from "../primitives/WorkflowStepper";
import { WorkflowStepId } from "../../adapter/types";
import { StatusPill } from "../primitives/StatusPill";

interface AppHeaderProps {
  periodName?: string;
  activeStep?: WorkflowStepId;
  openExceptionsCount?: number;
  onResetSession?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  periodName = "January 2024 Close (2024.1)",
  activeStep = "investigate",
  openExceptionsCount,
  onResetSession,
}) => {
  return (
    <header
      style={{
        height: "56px",
        backgroundColor: "var(--cp-bg-surface)",
        borderBottom: "1px solid var(--cp-border-default)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 20,
        boxShadow: "var(--cp-shadow-xs)",
      }}
    >
      {/* Left: Brand & Period */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              backgroundColor: "var(--cp-text-primary)",
              color: "var(--cp-text-inverted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--cp-text-primary)",
                  letterSpacing: "-0.02em",
                }}
              >
                ClosePilot
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "1px 5px",
                  borderRadius: "var(--cp-radius-xs)",
                  backgroundColor: "var(--cp-bg-canvas-subtle)",
                  border: "1px solid var(--cp-border-subtle)",
                  color: "var(--cp-text-secondary)",
                }}
              >
                AUTONOMOUS RECONCILIATION
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            height: "18px",
            width: "1px",
            backgroundColor: "var(--cp-border-default)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--cp-text-secondary)",
            fontWeight: 500,
          }}
        >
          <span>Period:</span>
          <span
            className="cp-mono"
            style={{
              color: "var(--cp-text-primary)",
              fontWeight: 600,
              backgroundColor: "var(--cp-bg-canvas-subtle)",
              padding: "2px 10px",
              borderRadius: "var(--cp-radius-pill)",
              border: "1px solid var(--cp-border-subtle)",
              fontSize: "12px",
            }}
          >
            {periodName}
          </span>
        </div>
      </div>

      {/* Center: Ingest → Match → Investigate → Resolve → Report */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <WorkflowStepper activeStep={activeStep} />
      </div>

      {/* Right: Operational Status */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {openExceptionsCount !== undefined && openExceptionsCount > 0 ? (
          <StatusPill variant="human_review" label={`${openExceptionsCount} Cases Require Review`} size="md" />
        ) : openExceptionsCount === 0 ? (
          <StatusPill variant="resolved" label="All Cases Closed" size="md" />
        ) : (
          <StatusPill variant="human_review" label="Review Required" size="md" />
        )}
        {onResetSession && (
          <button
            onClick={onResetSession}
            title="Reset in-memory session and return to Start Month-End Close"
            style={{
              padding: "4px 12px",
              borderRadius: "var(--cp-radius-pill)",
              backgroundColor: "var(--cp-bg-surface)",
              border: "1px solid var(--cp-border-default)",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--cp-text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--cp-text-primary)";
              e.currentTarget.style.color = "var(--cp-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--cp-border-default)";
              e.currentTarget.style.color = "var(--cp-text-secondary)";
            }}
          >
            <span>↺</span>
            <span>New Close Session</span>
          </button>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "var(--cp-radius-pill)",
            backgroundColor: "var(--cp-bg-canvas-subtle)",
            border: "1px solid var(--cp-border-subtle)",
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--cp-text-secondary)",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "var(--cp-status-success-dot)",
            }}
          />
          <span>Engine v0.1.0</span>
        </div>
      </div>
    </header>
  );
};
