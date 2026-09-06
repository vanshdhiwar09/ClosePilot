// src/ui/components/primitives/StatusPill.tsx
import React from "react";

export type StatusPillVariant =
  | "auto_resolved"
  | "human_review"
  | "investigating"
  | "exception"
  | "neutral";

interface StatusPillProps {
  variant: StatusPillVariant;
  label?: string;
  size?: "sm" | "md";
  showDot?: boolean;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  variant,
  label,
  size = "md",
  showDot = true,
}) => {
  let bg = "var(--cp-status-neutral-bg)";
  let border = "var(--cp-status-neutral-border)";
  let text = "var(--cp-status-neutral-text)";
  let dot = "var(--cp-text-tertiary)";
  let defaultLabel = "Neutral";

  switch (variant) {
    case "auto_resolved":
      bg = "var(--cp-status-success-bg)";
      border = "var(--cp-status-success-border)";
      text = "var(--cp-status-success-text)";
      dot = "var(--cp-status-success-dot)";
      defaultLabel = "Auto-Resolved";
      break;
    case "human_review":
      bg = "var(--cp-status-warning-bg)";
      border = "var(--cp-status-warning-border)";
      text = "var(--cp-status-warning-text)";
      dot = "var(--cp-status-warning-dot)";
      defaultLabel = "Human Review";
      break;
    case "investigating":
      bg = "var(--cp-status-info-bg)";
      border = "var(--cp-status-info-border)";
      text = "var(--cp-status-info-text)";
      dot = "var(--cp-status-info-dot)";
      defaultLabel = "Investigating";
      break;
    case "exception":
      bg = "var(--cp-status-danger-bg)";
      border = "var(--cp-status-danger-border)";
      text = "var(--cp-status-danger-text)";
      dot = "var(--cp-status-danger-dot)";
      defaultLabel = "Exception";
      break;
  }

  const isSmall = size === "sm";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? "5px" : "6px",
        padding: isSmall ? "2px 8px" : "3px 10px",
        borderRadius: "var(--cp-radius-pill)",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: text,
        fontSize: isSmall ? "11px" : "12px",
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {showDot && (
        <span
          style={{
            width: isSmall ? "5px" : "6px",
            height: isSmall ? "5px" : "6px",
            borderRadius: "50%",
            backgroundColor: dot,
            flexShrink: 0,
          }}
        />
      )}
      <span>{label || defaultLabel}</span>
    </span>
  );
};
