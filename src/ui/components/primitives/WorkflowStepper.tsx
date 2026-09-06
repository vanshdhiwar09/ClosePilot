// src/ui/components/primitives/WorkflowStepper.tsx
import React from "react";
import { WorkflowStepId } from "../../adapter/types";

interface WorkflowStepperProps {
  activeStep?: WorkflowStepId;
}

const STEPS: Array<{ id: WorkflowStepId; label: string; description: string }> = [
  { id: "ingest", label: "Ingest", description: "Records loaded" },
  { id: "match", label: "Match", description: "Deterministic engine" },
  { id: "investigate", label: "Investigate", description: "Agent running" },
  { id: "resolve", label: "Resolve", description: "Human review" },
  { id: "report", label: "Report", description: "Close package" },
];

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  activeStep = "investigate",
}) => {
  const activeIndex = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        backgroundColor: "var(--cp-bg-surface)",
        padding: "4px 10px",
        borderRadius: "var(--cp-radius-pill)",
        border: "1px solid var(--cp-border-default)",
        boxShadow: "var(--cp-shadow-xs)",
      }}
    >
      {STEPS.map((step, idx) => {
        const isCurrent = step.id === activeStep;
        const isPast = idx < activeIndex;

        let textColor = "var(--cp-text-tertiary)";
        let fontWeight = 400;
        let bg = "transparent";
        let border = "transparent";

        if (isCurrent) {
          textColor = "var(--cp-status-success-text)";
          fontWeight = 600;
          bg = "var(--cp-status-success-bg)";
          border = "var(--cp-status-success-border)";
        } else if (isPast) {
          textColor = "var(--cp-text-secondary)";
          fontWeight = 500;
        }

        return (
          <React.Fragment key={step.id}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: isCurrent ? "2px 8px" : "2px 4px",
                borderRadius: "var(--cp-radius-pill)",
                backgroundColor: bg,
                border: `1px solid ${border}`,
                color: textColor,
                fontSize: "11px",
                fontWeight,
                lineHeight: 1.2,
                transition: "all 0.15s ease",
              }}
              title={step.description}
            >
              {isCurrent && (
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    backgroundColor: "var(--cp-status-success-dot)",
                    display: "inline-block",
                  }}
                />
              )}
              <span>{step.label}</span>
            </div>

            {idx < STEPS.length - 1 && (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--cp-text-tertiary)",
                  userSelect: "none",
                }}
              >
                →
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
