// src/ui/components/primitives/Button.tsx
import React, { useState } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  icon,
  iconPosition = "left",
  style,
  disabled,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  let bg = "var(--cp-bg-surface)";
  let border = "1px solid var(--cp-border-default)";
  let text = "var(--cp-text-primary)";
  let shadow = "var(--cp-shadow-xs)";

  if (variant === "primary") {
    bg = isHovered ? "#22252C" : "var(--cp-text-primary)";
    border = "1px solid var(--cp-text-primary)";
    text = "var(--cp-text-inverted)";
    shadow = "var(--cp-shadow-sm)";
  } else if (variant === "secondary") {
    bg = isHovered ? "var(--cp-bg-surface-hover)" : "var(--cp-bg-surface)";
    border = isHovered ? "1px solid var(--cp-border-strong)" : "1px solid var(--cp-border-default)";
    text = "var(--cp-text-primary)";
  } else if (variant === "outline") {
    bg = isHovered ? "var(--cp-bg-canvas-subtle)" : "transparent";
    border = "1px solid var(--cp-border-default)";
    text = "var(--cp-text-primary)";
    shadow = "none";
  } else if (variant === "ghost") {
    bg = isHovered ? "var(--cp-bg-canvas-subtle)" : "transparent";
    border = "1px solid transparent";
    text = isHovered ? "var(--cp-text-primary)" : "var(--cp-text-secondary)";
    shadow = "none";
  }

  let padding = "6px 14px";
  let fontSize = "13px";
  let height = "32px";

  if (size === "sm") {
    padding = "4px 10px";
    fontSize = "12px";
    height = "26px";
  } else if (size === "lg") {
    padding = "8px 18px";
    fontSize = "14px";
    height = "38px";
  }

  return (
    <button
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsActive(false);
      }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        height,
        padding,
        backgroundColor: bg,
        border,
        color: text,
        borderRadius: "var(--cp-radius-sm)",
        fontSize,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: shadow,
        transition: "all 0.15s ease",
        transform: isActive && !disabled ? "scale(0.985)" : "none",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...props}
    >
      {icon && iconPosition === "left" && <span style={{ display: "inline-flex" }}>{icon}</span>}
      {children}
      {icon && iconPosition === "right" && <span style={{ display: "inline-flex" }}>{icon}</span>}
    </button>
  );
};
