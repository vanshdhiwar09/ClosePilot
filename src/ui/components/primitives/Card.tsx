// src/ui/components/primitives/Card.tsx
import React from "react";

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  style,
  noPadding = false,
}) => {
  return (
    <div
      style={{
        backgroundColor: "var(--cp-bg-surface)",
        border: "1px solid var(--cp-border-default)",
        borderRadius: "var(--cp-radius-md)",
        boxShadow: "var(--cp-shadow-sm)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "16px 20px 12px 20px",
            borderBottom: "1px solid var(--cp-border-subtle)",
            gap: "12px",
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--cp-text-primary)",
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--cp-text-secondary)",
                  marginTop: "2px",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}

      <div style={{ padding: noPadding ? "0" : "18px 20px", flex: 1 }}>{children}</div>
    </div>
  );
};
