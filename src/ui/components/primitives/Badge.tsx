// src/ui/components/primitives/Badge.tsx
import React from "react";

export type BadgeVariant = "neutral" | "emerald" | "amber" | "rose" | "indigo";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
}) => {
  let bg = "var(--cp-status-neutral-bg)";
  let border = "var(--cp-status-neutral-border)";
  let text = "var(--cp-status-neutral-text)";

  switch (variant) {
    case "emerald":
      bg = "var(--cp-status-success-bg)";
      border = "var(--cp-status-success-border)";
      text = "var(--cp-status-success-text)";
      break;
    case "amber":
      bg = "var(--cp-status-warning-bg)";
      border = "var(--cp-status-warning-border)";
      text = "var(--cp-status-warning-text)";
      break;
    case "rose":
      bg = "var(--cp-status-danger-bg)";
      border = "var(--cp-status-danger-border)";
      text = "var(--cp-status-danger-text)";
      break;
    case "indigo":
      bg = "var(--cp-status-info-bg)";
      border = "var(--cp-status-info-border)";
      text = "var(--cp-status-info-text)";
      break;
  }

  const isSmall = size === "sm";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isSmall ? "1px 6px" : "2px 8px",
        borderRadius: "var(--cp-radius-xs)",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: text,
        fontSize: isSmall ? "11px" : "12px",
        fontWeight: 500,
        lineHeight: 1.3,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};
