// src/ui/components/layout/AppSidebar.tsx
import React from "react";
import { Badge } from "../primitives/Badge";

export type NavTabId =
  | "overview"
  | "reconciliation"
  | "exceptions"
  | "investigations"
  | "evidence"
  | "close-package";

interface AppSidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  exceptionCount?: number;
  investigationCount?: number;
  evidenceCount?: number;
}

type NavItemConfig = {
  id: NavTabId;
  label: string;
  badge?: number;
  badgeVariant?: "rose" | "indigo" | "neutral";
  icon: (active: boolean) => React.ReactNode;
};

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  exceptionCount = 7,
  investigationCount = 7,
  evidenceCount = 5,
}) => {
  const NAV_ITEMS: NavItemConfig[] = [
    {
      id: "overview",
      label: "Overview",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--cp-text-primary)" : "var(--cp-text-secondary)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
    },
    {
      id: "reconciliation",
      label: "Reconciliation",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--cp-text-primary)" : "var(--cp-text-secondary)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      ),
    },
    {
      id: "exceptions",
      label: "Exceptions",
      badge: exceptionCount,
      badgeVariant: "rose",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--cp-text-primary)" : "var(--cp-text-secondary)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      ),
    },
    {
      id: "investigations",
      label: "Investigations",
      badge: investigationCount,
      badgeVariant: "indigo",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--cp-text-primary)" : "var(--cp-text-secondary)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      ),
    },
    {
      id: "evidence",
      label: "Evidence",
      badge: evidenceCount,
      badgeVariant: "neutral",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--cp-text-primary)" : "var(--cp-text-secondary)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      ),
    },
    {
      id: "close-package",
      label: "Close Package",
      icon: (active) => (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={active ? "var(--cp-text-primary)" : "var(--cp-text-secondary)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      ),
    },
  ];

  return (
    <aside
      style={{
        width: "220px",
        backgroundColor: "var(--cp-bg-surface)",
        borderRight: "1px solid var(--cp-border-default)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flexShrink: 0,
        height: "calc(100vh - 56px)",
        position: "sticky",
        top: "56px",
      }}
    >
      {/* Navigation List */}
      <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--cp-text-tertiary)",
            padding: "4px 10px 8px 10px",
          }}
        >
          Month-End Close
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: "var(--cp-radius-sm)",
                backgroundColor: isActive ? "var(--cp-bg-canvas-subtle)" : "transparent",
                border: isActive ? "1px solid var(--cp-border-subtle)" : "1px solid transparent",
                color: isActive ? "var(--cp-text-primary)" : "var(--cp-text-secondary)",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.12s ease",
                textAlign: "left",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "var(--cp-bg-surface-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {item.icon(isActive)}
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <Badge variant={item.badgeVariant || "neutral"} size="sm">
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Footer: Deterministic Safety Assurance */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid var(--cp-border-subtle)",
          backgroundColor: "var(--cp-bg-surface)",
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "var(--cp-radius-sm)",
            backgroundColor: "var(--cp-bg-canvas-subtle)",
            border: "1px solid var(--cp-border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--cp-status-success-text)",
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
            <span>Deterministic Core</span>
          </div>
          <p
            style={{
              fontSize: "11px",
              color: "var(--cp-text-tertiary)",
              lineHeight: 1.35,
            }}
          >
            BigInt arithmetic. Agent policy guardrails enforced.
          </p>
        </div>
      </div>
    </aside>
  );
};
