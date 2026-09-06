// src/ui/components/primitives/MetricCard.tsx
import React from "react";
import { Badge, BadgeVariant } from "./Badge";

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  badgeText?: string;
  badgeVariant?: BadgeVariant;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  detail,
  badgeText,
  badgeVariant = "neutral",
  icon,
}) => {
  return (
    <div
      style={{
        backgroundColor: "var(--cp-bg-surface)",
        border: "1px solid var(--cp-border-default)",
        borderRadius: "var(--cp-radius-md)",
        padding: "16px 18px",
        boxShadow: "var(--cp-shadow-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--cp-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              color: "var(--cp-text-tertiary)",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          marginTop: "2px",
        }}
      >
        <span
          className="cp-mono"
          style={{
            fontSize: "26px",
            fontWeight: 700,
            color: "var(--cp-text-primary)",
            letterSpacing: "-0.025em",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {badgeText && (
          <Badge variant={badgeVariant} size="sm">
            {badgeText}
          </Badge>
        )}
      </div>

      {detail && (
        <span
          style={{
            fontSize: "12px",
            color: "var(--cp-text-tertiary)",
            marginTop: "2px",
            lineHeight: 1.3,
          }}
        >
          {detail}
        </span>
      )}
    </div>
  );
};
