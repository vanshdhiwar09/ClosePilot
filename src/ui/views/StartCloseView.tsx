// src/ui/views/StartCloseView.tsx
// Visual Landing Page faithfully reproducing closepilot_clone.html
// Exactly matches:
// - Max-width 1100px container, subtle 48px paper grid and central soft glow
// - Minimal top navbar (3-layer logo, "Product ▾", "How it works", "Why ClosePilot", "View Demo" pill)
// - Centered hero with "AUTONOMOUS FINANCE OPERATIONS" badge, "MONTH-END RECONCILIATION" uppercase label
// - Editorial headline "Month-end close, on autopilot.", supporting text, and dual CTAs
// - Floating finance artifacts (Bank card with toggle, Ledger list, Document icon, Exception badge, Checkmark badge)
// - Subtle SVG connecting lines linking floating artifacts to the browser window
// - Browser mockup window with traffic lights, sidebar, header stepper, tabs, real ClosePilot transactions (BT001, BT003, BT005, BT007),
//   and docked Evidence Locker panel with matching signals and human review escalation
// - "How it works" 3-step process cards with connecting line
// - "Why ClosePilot" 4-card bento box (Efficiency 10x, Dark Compliance card, Human in the loop toggle, Integration / Close package)
// - Operational "Start a month-end close" launchpad ("Synthetic Demo Dataset — 2024.1" and "Upload Reconciliation JSON")
// - Accurate privacy disclaimer: "Processed locally in this browser session. Data is not persisted."
// - Clean footer with ClosePilot logo and copyright

import React, { useState, useRef } from "react";
import {
  validateReconciliationJSON,
  ReconciliationDatasetValidationResult,
} from "../adapter/data-adapter";

interface StartCloseViewProps {
  onLoadDemo: () => Promise<void>;
  onLoadCustom: (data: Record<string, unknown>, label: string) => Promise<void>;
  isLoading?: boolean;
}

export const StartCloseView: React.FC<StartCloseViewProps> = ({
  onLoadDemo,
  onLoadCustom,
  isLoading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startSectionRef = useRef<HTMLDivElement | null>(null);
  const howItWorksRef = useRef<HTMLDivElement | null>(null);
  const whyClosePilotRef = useRef<HTMLDivElement | null>(null);

  const [validationResult, setValidationResult] = useState<ReconciliationDatasetValidationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [mockAiLoading, setMockAiLoading] = useState(false);
  const [mockAiCompleted, setMockAiCompleted] = useState(false);

  const scrollToStart = () => {
    startSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToWhyClosePilot = () => {
    whyClosePilotRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessingFile(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = validateReconciliationJSON(text);
        setValidationResult(result);
      } catch (err: any) {
        setValidationResult({
          isValid: false,
          errors: [`Failed to read file: ${err.message}`],
        });
      } finally {
        setIsProcessingFile(false);
      }
    };
    reader.onerror = () => {
      setValidationResult({
        isValid: false,
        errors: ["Failed to read the selected file."],
      });
      setIsProcessingFile(false);
    };
    reader.readAsText(file);
  };

  const handleCustomSubmit = async () => {
    if (validationResult && validationResult.isValid && validationResult.data) {
      await onLoadCustom(validationResult.data, validationResult.datasetLabel || fileName || "Custom JSON Dataset");
    }
  };

  const handleMockAiInvestigation = () => {
    setMockAiLoading(true);
    setTimeout(() => {
      setMockAiLoading(false);
      setMockAiCompleted(true);
    }, 900);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fdfdfc",
        position: "relative",
        overflowX: "hidden",
        color: "#111111",
        paddingBottom: "96px",
      }}
    >
      {/* Background Grid & Soft Glow matching reference */}
      <div className="bg-grid" />
      <div className="glow-bg" />

      {/* Main Centered Container (max-w-[1100px] px-6) */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 24px",
          boxSizing: "border-box",
        }}
      >
        {/* 1. TOP NAVIGATION */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 0",
          }}
        >
          {/* Brand Logo & Name */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
              style={{
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "#111",
              }}
            >
              ClosePilot
            </span>
          </div>

          {/* Navigation Links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px",
              fontSize: "15px",
              fontWeight: 500,
              color: "#334155",
            }}
          >
            <button
              onClick={scrollToHowItWorks}
              style={{
                background: "none",
                border: "none",
                fontSize: "15px",
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: 0,
              }}
            >
              <span>Product</span>
              <svg style={{ width: "16px", height: "16px", opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={scrollToHowItWorks}
              style={{
                background: "none",
                border: "none",
                fontSize: "15px",
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
                padding: 0,
              }}
            >
              How it works
            </button>
            <button
              onClick={scrollToWhyClosePilot}
              style={{
                background: "none",
                border: "none",
                fontSize: "15px",
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Why ClosePilot
            </button>
          </div>

          {/* Right Action Button */}
          <button
            onClick={scrollToStart}
            style={{
              backgroundColor: "#1c1c1c",
              color: "#ffffff",
              padding: "10px 20px",
              borderRadius: "9999px",
              fontSize: "15px",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              transition: "background-color 0.2s ease, transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#000000")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1c1c1c")}
          >
            View Demo
          </button>
        </nav>

        {/* 2. HERO SECTION (Wide stage containing headline and floating Bank & Ledger cards with zero overlap) */}
        <div
          style={{
            position: "relative",
            maxWidth: "1060px",
            margin: "48px auto 40px auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Centered Hero Text Column */}
          <div
            style={{
              textAlign: "center",
              maxWidth: "660px",
              margin: "0 auto",
              position: "relative",
              zIndex: 10,
            }}
          >
            {/* Badges Container */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                marginBottom: "28px",
              }}
            >
              {/* Top Badge: AUTONOMOUS FINANCE OPERATIONS */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#f3f4f6",
                  color: "#475569",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  border: "1px solid rgba(226, 232, 240, 0.6)",
                  textTransform: "uppercase",
                }}
              >
                <svg style={{ width: "14px", height: "14px", opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Autonomous Finance Operations</span>
              </div>

              {/* Sub-label: MONTH-END RECONCILIATION */}
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                MONTH-END RECONCILIATION
              </div>
            </div>

            {/* Main Headline */}
            <h1
              style={{
                fontSize: "62px",
                lineHeight: 1.1,
                fontWeight: 700,
                color: "#111",
                marginBottom: "24px",
                letterSpacing: "-0.025em",
              }}
            >
              Month-end close, on autopilot.
            </h1>

            {/* Supporting Description */}
            <p
              style={{
                fontSize: "18px",
                color: "#475569",
                marginBottom: "36px",
                maxWidth: "600px",
                marginRight: "auto",
                marginLeft: "auto",
                lineHeight: 1.6,
              }}
            >
              ClosePilot reconciles financial records, investigates exceptions, gathers evidence, and prepares a close-ready report — with human oversight where it matters.
            </p>

            {/* Action CTAs */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "24px",
              }}
            >
              <button
                onClick={scrollToStart}
                style={{
                  backgroundColor: "#232323",
                  color: "#ffffff",
                  padding: "14px 28px",
                  borderRadius: "9999px",
                  fontWeight: 500,
                  fontSize: "15px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#000000";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#232323";
                  e.currentTarget.style.transform = "none";
                }}
              >
                See ClosePilot in action
              </button>
              <button
                onClick={scrollToHowItWorks}
                style={{
                  background: "none",
                  border: "none",
                  color: "#111",
                  fontWeight: 500,
                  fontSize: "15px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  padding: 0,
                  transition: "opacity 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <span>View workflow</span>
                <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Left Floating Bank Card (Positioned beside hero text with aesthetic elevation) */}
          <div
            style={{
              position: "absolute",
              left: "8px",
              top: "135px",
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              boxShadow: "0 14px 34px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(15, 23, 42, 0.03)",
              padding: "14px 16px",
              width: "190px",
              zIndex: 20,
              boxSizing: "border-box",
              transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 20px 42px -6px rgba(15, 23, 42, 0.12), 0 6px 16px -2px rgba(15, 23, 42, 0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 14px 34px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(15, 23, 42, 0.03)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
                borderBottom: "1px solid #f8fafc",
                paddingBottom: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                <svg style={{ width: "16px", height: "16px", color: "#475569" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
                <span>Bank</span>
              </div>
              <span
                style={{
                  fontSize: "10px",
                  color: "#cbd5e1",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                BT007
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                Bank transaction
              </span>
              <span className="cp-mono" style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                $15,000.00
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  width: "28px",
                  height: "16px",
                  backgroundColor: "#e2e8f0",
                  borderRadius: "9999px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#ffffff",
                    borderRadius: "9999px",
                    position: "absolute",
                    left: "2px",
                    top: "2px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Top Right Floating Checkmark Badge */}
          <div
            style={{
              position: "absolute",
              top: "25px",
              right: "175px",
              backgroundColor: "#eef0f0",
              borderRadius: "9999px",
              padding: "7px",
              border: "1px solid #ffffff",
              boxShadow: "0 8px 20px -3px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.03)",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg style={{ width: "18px", height: "18px", color: "#334155" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Right Floating Ledger Card (Positioned beside headline with aesthetic elevation) */}
          <div
            style={{
              position: "absolute",
              right: "8px",
              top: "55px",
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              boxShadow: "0 14px 34px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(15, 23, 42, 0.03)",
              padding: "14px 16px",
              width: "155px",
              zIndex: 20,
              boxSizing: "border-box",
              transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 20px 42px -6px rgba(15, 23, 42, 0.12), 0 6px 16px -2px rgba(15, 23, 42, 0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 14px 34px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(15, 23, 42, 0.03)";
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#1e293b",
                marginBottom: "8px",
                paddingBottom: "6px",
                borderBottom: "1px solid #f8fafc",
              }}
            >
              Ledger
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "9px",
                  color: "#94a3b8",
                  fontWeight: 500,
                  paddingBottom: "2px",
                }}
              >
                <span style={{ width: "25%" }}>Date</span>
                <span style={{ width: "50%", textAlign: "center" }}>Desc</span>
                <span style={{ width: "25%", textAlign: "right" }}>Amt</span>
              </div>
              {/* Ledger skeletal rows */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ height: "3px", width: "16px", backgroundColor: "#e2e8f0", borderRadius: "9999px" }} />
                <div style={{ height: "3px", width: "44px", backgroundColor: "#e2e8f0", borderRadius: "9999px", margin: "0 auto" }} />
                <div style={{ height: "3px", width: "22px", backgroundColor: "#e2e8f0", borderRadius: "9999px", marginLeft: "auto" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ height: "3px", width: "16px", backgroundColor: "#e2e8f0", borderRadius: "9999px" }} />
                <div style={{ height: "3px", width: "36px", backgroundColor: "#e2e8f0", borderRadius: "9999px", margin: "0 auto" }} />
                <div style={{ height: "3px", width: "26px", backgroundColor: "#e2e8f0", borderRadius: "9999px", marginLeft: "auto" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ height: "3px", width: "16px", backgroundColor: "#e2e8f0", borderRadius: "9999px" }} />
                <div style={{ height: "3px", width: "50px", backgroundColor: "#e2e8f0", borderRadius: "9999px", margin: "0 auto" }} />
                <div style={{ height: "3px", width: "18px", backgroundColor: "#e2e8f0", borderRadius: "9999px", marginLeft: "auto" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ height: "3px", width: "16px", backgroundColor: "#e2e8f0", borderRadius: "9999px" }} />
                <div style={{ height: "3px", width: "32px", backgroundColor: "#e2e8f0", borderRadius: "9999px", margin: "0 auto" }} />
                <div style={{ height: "3px", width: "22px", backgroundColor: "#e2e8f0", borderRadius: "9999px", marginLeft: "auto" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ height: "3px", width: "16px", backgroundColor: "#e2e8f0", borderRadius: "9999px" }} />
                <div style={{ height: "3px", width: "42px", backgroundColor: "#e2e8f0", borderRadius: "9999px", margin: "0 auto" }} />
                <div style={{ height: "3px", width: "28px", backgroundColor: "#e2e8f0", borderRadius: "9999px", marginLeft: "auto" }} />
              </div>
            </div>
          </div>
        </div>

        {/* 3. MAIN APP MOCKUP STAGE (Generous stage with cleanly docked Document & Exception badges) */}
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "1060px",
            margin: "32px auto 0 auto",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* Left Floating Document Card (Clean 30px margin outside browser, zero overlap) */}
          <div
            style={{
              position: "absolute",
              left: "20px",
              top: "160px",
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              boxShadow: "0 12px 28px -4px rgba(15, 23, 42, 0.08), 0 3px 10px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(15, 23, 42, 0.03)",
              padding: "10px",
              zIndex: 25,
              boxSizing: "border-box",
              transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 18px 36px -6px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 12px 28px -4px rgba(15, 23, 42, 0.08), 0 3px 10px -2px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(15, 23, 42, 0.03)";
            }}
          >
            <svg width="38" height="46" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 8C4 5.79086 5.79086 4 8 4H24L36 16V40C36 42.2091 34.2091 44 32 44H8C5.79086 44 4 42.2091 4 40V8Z" stroke="#94a3b8" strokeWidth="2" fill="white" />
              <path d="M24 4V16H36" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 24H28" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 30H28" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 36H22" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Right Floating Exception Badge (Clean 25px margin outside browser, zero overlap) */}
          <div
            style={{
              position: "absolute",
              right: "12px",
              top: "200px",
              backgroundColor: "#ffffff",
              borderRadius: "9999px",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              boxShadow: "0 10px 24px -3px rgba(15, 23, 42, 0.08), 0 2px 8px -1px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(15, 23, 42, 0.03)",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              zIndex: 25,
              boxSizing: "border-box",
              transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 16px 32px -4px rgba(15, 23, 42, 0.12), 0 3px 10px -1px rgba(15, 23, 42, 0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 10px 24px -3px rgba(15, 23, 42, 0.08), 0 2px 8px -1px rgba(15, 23, 42, 0.03), 0 0 0 1px rgba(15, 23, 42, 0.03)";
            }}
          >
            <svg style={{ width: "16px", height: "16px", color: "#1e293b" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
              Exception
            </span>
          </div>

          {/* BROWSER MOCKUP WINDOW (Centered with 850px width, clean borders, and soft elevation) */}
          <div
            style={{
              width: "100%",
              maxWidth: "850px",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 25px 65px -15px rgba(15, 23, 42, 0.11), 0 0 0 1px rgba(15, 23, 42, 0.05)",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              overflow: "hidden",
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              height: "520px",
              boxSizing: "border-box",
            }}
          >
            {/* Browser Title Bar */}
            <div
              style={{
                height: "40px",
                backgroundColor: "#ffffff",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px",
                boxSizing: "border-box",
              }}
            >
              {/* Traffic light dots */}
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ff5f56" }} />
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ffbd2e" }} />
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#27c93f" }} />
              </div>

              {/* Center browser nav arrows */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#94a3b8" }}>
                <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Right browser actions */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#94a3b8" }}>
                <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>

            {/* App Interior Layout */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", backgroundColor: "#ffffff" }}>
              {/* Sidebar */}
              <div
                style={{
                  width: "200px",
                  backgroundColor: "#fdfcfb",
                  borderRight: "1px solid #f1f5f9",
                  display: "flex",
                  flexDirection: "column",
                  padding: "20px 12px",
                  boxSizing: "border-box",
                }}
              >
                {/* Small Logo */}
                <div style={{ marginBottom: "24px", padding: "0 12px" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 17L12 22L22 17" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12L12 17L22 12" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Sidebar Navigation */}
                <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", color: "#64748b", borderRadius: "8px", fontSize: "13px", fontWeight: 500 }}>
                    <svg style={{ width: "16px", height: "16px", opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Home</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", color: "#64748b", borderRadius: "8px", fontSize: "13px", fontWeight: 500 }}>
                    <svg style={{ width: "16px", height: "16px", opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <span>Transactions</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", color: "#64748b", borderRadius: "8px", fontSize: "13px", fontWeight: 500 }}>
                    <svg style={{ width: "16px", height: "16px", opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Matched</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", color: "#0f172a", backgroundColor: "rgba(241, 245, 249, 0.8)", borderRadius: "8px", fontSize: "13px", fontWeight: 600 }}>
                    <span style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, border: "2px solid #0f172a", borderRadius: "4px" }}>
                      !
                    </span>
                    <span>Exceptions</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", color: "#64748b", borderRadius: "8px", fontSize: "13px", fontWeight: 500 }}>
                    <svg style={{ width: "16px", height: "16px", opacity: 0.7 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <span>Evidence</span>
                  </div>
                </nav>

                <div style={{ marginTop: "auto", padding: "0 12px" }}>
                  <svg style={{ width: "20px", height: "20px", color: "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              {/* Main Content Area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Header */}
                <div
                  style={{
                    padding: "20px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    boxSizing: "border-box",
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
                      Month-end Reconciliation
                    </h2>
                    <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                      Status: Agent running
                    </p>
                  </div>

                  {/* Workflow Steps */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      color: "#64748b",
                      fontWeight: 500,
                      marginTop: "4px",
                    }}
                  >
                    <span>Ingest</span>
                    <svg style={{ width: "12px", height: "12px", color: "#cbd5e1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span>Match</span>
                    <svg style={{ width: "12px", height: "12px", color: "#cbd5e1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span
                      style={{
                        backgroundColor: "#dcfce7",
                        color: "#166534",
                        padding: "4px 10px",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}
                    >
                      Investigate
                    </span>
                    <svg style={{ width: "12px", height: "12px", color: "#cbd5e1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span>Resolve</span>
                    <svg style={{ width: "12px", height: "12px", color: "#cbd5e1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span>Report</span>
                  </div>
                </div>

                {/* Table Content & Docked Evidence Panel */}
                <div
                  style={{
                    padding: "0 24px",
                    position: "relative",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Tabs & Search */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      borderBottom: "1px solid #e2e8f0",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "24px", fontSize: "13px", fontWeight: 600 }}>
                      <span style={{ color: "#94a3b8", paddingBottom: "10px", cursor: "pointer" }}>Matched</span>
                      <span style={{ color: "#0f172a", borderBottom: "2px solid #0f172a", paddingBottom: "10px", cursor: "pointer" }}>Exceptions</span>
                      <span style={{ color: "#94a3b8", paddingBottom: "10px", cursor: "pointer" }}>Human Review</span>
                    </div>

                    <div style={{ position: "relative", marginBottom: "6px" }}>
                      <svg style={{ width: "14px", height: "14px", position: "absolute", left: "10px", top: "8px", color: "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search"
                        readOnly
                        value=""
                        style={{
                          paddingLeft: "32px",
                          paddingRight: "12px",
                          paddingTop: "6px",
                          paddingBottom: "6px",
                          fontSize: "12px",
                          fontWeight: 500,
                          backgroundColor: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          width: "128px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div style={{ width: "100%", fontSize: "13px", flex: 1 }}>
                    {/* Header Row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: "16px",
                        padding: "12px 0",
                        borderBottom: "1px solid #f1f5f9",
                        fontWeight: 600,
                        color: "#94a3b8",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      <div>Transaction</div>
                      <div>Amount</div>
                      <div>Type</div>
                      <div>Status</div>
                    </div>

                    {/* Data Rows */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                      {/* Row 1 */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: "16px",
                          padding: "12px 4px",
                          alignItems: "center",
                          borderBottom: "1px solid #f8fafc",
                        }}
                      >
                        <div style={{ fontWeight: 500, color: "#334155" }}>AWS payment</div>
                        <div className="cp-mono" style={{ fontWeight: 500, color: "#334155" }}>$4,820.00</div>
                        <div style={{ color: "#64748b", fontWeight: 500 }}>Timing difference</div>
                        <div>
                          <span
                            style={{
                              backgroundColor: "#fffbeb",
                              color: "#b45309",
                              fontSize: "11px",
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontWeight: 600,
                            }}
                          >
                            Investigating
                          </span>
                        </div>
                      </div>

                      {/* Row 2 */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: "16px",
                          padding: "12px 4px",
                          alignItems: "center",
                          borderBottom: "1px solid #f8fafc",
                        }}
                      >
                        <div style={{ fontWeight: 500, color: "#334155" }}>Adobe invoice</div>
                        <div className="cp-mono" style={{ fontWeight: 500, color: "#334155" }}>$1,250.00</div>
                        <div style={{ color: "#64748b", fontWeight: 500 }}>Exact match</div>
                        <div>
                          <span
                            style={{
                              backgroundColor: "#dcfce7",
                              color: "#166534",
                              fontSize: "11px",
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontWeight: 600,
                            }}
                          >
                            Reconciled
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Highlighted Context Anomaly (BT007) */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: "16px",
                          padding: "12px 8px",
                          alignItems: "center",
                          backgroundColor: "#f8f9fa",
                          borderTopRightRadius: "6px",
                          borderBottomRightRadius: "6px",
                          position: "relative",
                          borderLeft: "2px solid #111111",
                          zIndex: 20,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>Vendor payment</div>
                        <div className="cp-mono" style={{ fontWeight: 700, color: "#0f172a" }}>$15,000.00</div>
                        <div style={{ color: "#1e293b", fontWeight: 500 }}>Missing evidence</div>
                        <div>
                          <span
                            style={{
                              backgroundColor: "#fef2f2",
                              color: "#991b1b",
                              fontSize: "11px",
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontWeight: 600,
                              border: "1px solid #fee2e2",
                            }}
                          >
                            Human review
                          </span>
                        </div>
                      </div>

                      {/* Row 4 */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: "16px",
                          padding: "12px 4px",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 500, color: "#334155" }}>Vendor payment</div>
                        <div className="cp-mono" style={{ fontWeight: 500, color: "#334155" }}>$3,220.00</div>
                        <div style={{ color: "#64748b", fontWeight: 500 }}>Timing difference</div>
                        <div>
                          <span
                            style={{
                              backgroundColor: "#fffbeb",
                              color: "#b45309",
                              fontSize: "11px",
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontWeight: 600,
                            }}
                          >
                            Investigating
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Popover / Overlay (Docked Evidence Panel with aesthetic elevation) */}
                  <div
                    style={{
                      position: "absolute",
                      top: "155px",
                      right: "20px",
                      width: "305px",
                      backgroundColor: "#ffffff",
                      borderRadius: "14px",
                      border: "1px solid rgba(226, 232, 240, 0.9)",
                      boxShadow: "0 18px 40px -8px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.04)",
                      zIndex: 40,
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      boxSizing: "border-box",
                    }}
                  >
                    <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", margin: "0 0 12px 0" }}>
                      Evidence
                    </h3>

                    {/* 3 Citation Boxes */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: "8px",
                        marginBottom: "16px",
                      }}
                    >
                      {/* Bank Record Box */}
                      <div
                        style={{
                          backgroundColor: "#edfdf2",
                          border: "1px solid #bbf7d0",
                          borderRadius: "8px",
                          padding: "12px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          height: "76px",
                          boxSizing: "border-box",
                        }}
                      >
                        <svg style={{ width: "20px", height: "20px", color: "#166534", marginBottom: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                        <span style={{ fontSize: "9px", fontWeight: 600, color: "#166534", lineHeight: 1.2 }}>
                          Bank record
                        </span>
                      </div>

                      {/* Ledger Record Box */}
                      <div
                        style={{
                          backgroundColor: "#edfdf2",
                          border: "1px solid #bbf7d0",
                          borderRadius: "8px",
                          padding: "12px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          height: "76px",
                          boxSizing: "border-box",
                        }}
                      >
                        <svg style={{ width: "20px", height: "20px", color: "#166534", marginBottom: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span style={{ fontSize: "9px", fontWeight: 600, color: "#166534", lineHeight: 1.2 }}>
                          Ledger record
                        </span>
                      </div>

                      {/* Supporting Document Box (Missing / Discrepancy) */}
                      <div
                        style={{
                          backgroundColor: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          padding: "12px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          height: "76px",
                          position: "relative",
                          boxSizing: "border-box",
                        }}
                      >
                        <div style={{ position: "relative", marginBottom: "6px" }}>
                          <svg style={{ width: "20px", height: "20px", color: "#991b1b" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div
                            style={{
                              position: "absolute",
                              bottom: "-4px",
                              right: "-4px",
                              backgroundColor: "#ffffff",
                              borderRadius: "4px",
                              border: "1px solid #fecaca",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <svg style={{ width: "12px", height: "12px", color: "#dc2626" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                        </div>
                        <span style={{ fontSize: "9px", fontWeight: 600, color: "#991b1b", lineHeight: 1.2 }}>
                          Supporting<br />document
                        </span>
                      </div>
                    </div>

                    {/* Matching Signals */}
                    <div style={{ marginBottom: "20px" }}>
                      <h4 style={{ fontSize: "11px", color: "#0f172a", fontWeight: 600, margin: "0 0 8px 0" }}>
                        Matching signals
                      </h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {["Amount", "Vendor", "Reference", "Date"].map((sig) => (
                          <span
                            key={sig}
                            style={{
                              backgroundColor: "#edfdf2",
                              color: "#166534",
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: 600,
                              border: "1px solid #bbf7d0",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span>{sig}</span>
                            <svg style={{ width: "10px", height: "10px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Area */}
                    <div
                      style={{
                        marginTop: "auto",
                        borderTop: "1px solid #f1f5f9",
                        paddingTop: "12px",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#1e293b",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: "8px",
                        }}
                      >
                        Action Required
                      </div>

                      {!mockAiLoading && !mockAiCompleted && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <button
                            onClick={handleMockAiInvestigation}
                            style={{
                              width: "100%",
                              background: "linear-gradient(to right, #9333ea, #4f46e5)",
                              color: "#ffffff",
                              fontSize: "13px",
                              fontWeight: 600,
                              padding: "8px 0",
                              borderRadius: "6px",
                              border: "none",
                              cursor: "pointer",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                            }}
                          >
                            ✨ AI Investigation
                          </button>
                          <button
                            onClick={scrollToStart}
                            style={{
                              width: "100%",
                              backgroundColor: "#ffffff",
                              color: "#334155",
                              border: "1px solid #e2e8f0",
                              fontSize: "13px",
                              fontWeight: 600,
                              padding: "8px 0",
                              borderRadius: "6px",
                              cursor: "pointer",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            }}
                          >
                            Escalate to Human
                          </button>
                        </div>
                      )}

                      {mockAiLoading && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 0" }}>
                          <div style={{ width: "20px", height: "20px", border: "2px solid #9333ea", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: "8px" }} />
                          <span style={{ fontSize: "10px", color: "#9333ea", fontWeight: 500 }}>
                            Investigating exception BT007...
                          </span>
                        </div>
                      )}

                      {mockAiCompleted && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div
                            style={{
                              backgroundColor: "#faf5ff",
                              border: "1px solid #f3e8ff",
                              borderRadius: "8px",
                              padding: "10px",
                              fontSize: "11px",
                              color: "#334155",
                              lineHeight: 1.5,
                            }}
                          >
                            <strong style={{ color: "#581c87" }}>Recommendation:</strong> Amount matches ledger but supporting document SD007 is missing. Route to AP reviewer before approving.
                          </div>
                          <button
                            onClick={scrollToStart}
                            style={{
                              width: "100%",
                              backgroundColor: "#1c1c1c",
                              color: "#ffffff",
                              fontSize: "13px",
                              fontWeight: 600,
                              padding: "8px 0",
                              borderRadius: "6px",
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                            }}
                          >
                            <span>Approve & Review in Session</span>
                            <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. HOW IT WORKS SECTION (Matching closepilot_clone.html) */}
        <div
          ref={howItWorksRef}
          style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            marginTop: "160px",
            paddingTop: "40px",
            borderTop: "1px solid rgba(226, 232, 240, 0.5)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "64px",
              maxWidth: "672px",
              marginRight: "auto",
              marginLeft: "auto",
            }}
          >
            <h2
              style={{
                fontSize: "40px",
                fontWeight: 700,
                color: "#111",
                marginBottom: "20px",
                letterSpacing: "-0.02em",
              }}
            >
              The autonomous close process.
            </h2>
            <p style={{ fontSize: "17px", color: "#64748b", lineHeight: 1.6 }}>
              Connect your data sources once, and let ClosePilot's intelligent agents handle the repetitive matching and investigation.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "24px",
              position: "relative",
            }}
          >
            {/* Horizontal connecting line behind cards */}
            <div
              style={{
                position: "absolute",
                top: "48px",
                left: "15%",
                right: "15%",
                height: "2px",
                background: "linear-gradient(to right, transparent, #e2e8f0, transparent)",
                zIndex: 0,
              }}
            />

            {/* Step 1 */}
            <div
              className="premium-card-hover"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "32px",
                border: "1px solid #f1f5f9",
                position: "relative",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "12px",
                  border: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "24px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                <svg style={{ width: "24px", height: "24px", color: "#334155" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
                1. Auto-Ingest Data
              </h3>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                Loads bank statement feeds, general ledger journal entries, and supporting documents into an isolated session.
              </p>
            </div>

            {/* Step 2 */}
            <div
              className="premium-card-hover"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "32px",
                border: "1px solid #f1f5f9",
                position: "relative",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "12px",
                  border: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "24px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                <svg style={{ width: "24px", height: "24px", color: "#334155" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
                2. Multi-way Matching
              </h3>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                Uses deterministic matching rules and fuzzy tolerance logic to reconcile deposits against thousands of records.
              </p>
            </div>

            {/* Step 3 */}
            <div
              className="premium-card-hover"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "32px",
                border: "1px solid #f1f5f9",
                position: "relative",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  backgroundColor: "#faf5ff",
                  borderRadius: "12px",
                  border: "1px solid #f3e8ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "24px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                <svg style={{ width: "24px", height: "24px", color: "#7e22ce" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>
                3. AI Investigation
              </h3>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.6, margin: 0 }}>
                Autonomous agents investigate discrepancies, gather evidence citations, and route material cases to human review.
              </p>
            </div>
          </div>
        </div>

        {/* 5. WHY CLOSEPILOT (BENTO BOX) SECTION (Matching closepilot_clone.html) */}
        <div
          ref={whyClosePilotRef}
          style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            marginTop: "128px",
            marginBottom: "80px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2
              style={{
                fontSize: "40px",
                fontWeight: 700,
                color: "#111",
                marginBottom: "20px",
                letterSpacing: "-0.02em",
              }}
            >
              Built for modern finance teams.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "24px",
            }}
          >
            {/* Bento 1: Efficiency (Span 2) */}
            <div
              className="premium-card-hover"
              style={{
                gridColumn: "span 2",
                backgroundColor: "#ffffff",
                borderRadius: "24px",
                border: "1px solid #f1f5f9",
                padding: "40px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                overflow: "hidden",
                position: "relative",
                minHeight: "280px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  opacity: 0.08,
                  pointerEvents: "none",
                  transform: "translate(25%, 25%)",
                }}
              >
                <svg width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#f0fdf4",
                    color: "#166534",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    border: "1px solid #bbf7d0",
                    textTransform: "uppercase",
                    marginBottom: "16px",
                  }}
                >
                  Efficiency
                </div>
                <h3 style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                  Close books in hours, not days.
                </h3>
                <p style={{ fontSize: "15px", color: "#64748b", maxWidth: "384px", margin: 0, lineHeight: 1.6 }}>
                  Eliminate spreadsheet fatigue. Automate matching and focus your accounting team solely on high-impact exceptions.
                </p>
              </div>
              <div style={{ marginTop: "32px", display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "60px", fontWeight: 900, letterSpacing: "-0.04em", color: "#111" }}>
                  10x
                </span>
                <span style={{ fontSize: "18px", fontWeight: 600, color: "#94a3b8" }}>
                  faster reconciliation
                </span>
              </div>
            </div>

            {/* Bento 2: Audit Ready (Span 1, Dark Card) */}
            <div
              className="premium-card-hover"
              style={{
                backgroundColor: "#0f172a",
                borderRadius: "24px",
                border: "1px solid #1e293b",
                padding: "32px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden",
                color: "#ffffff",
                minHeight: "280px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: "-24px",
                  top: "-24px",
                  width: "128px",
                  height: "128px",
                  backgroundColor: "#9333ea",
                  borderRadius: "9999px",
                  filter: "blur(48px)",
                  opacity: 0.2,
                }}
              />
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#1e293b",
                    color: "#cbd5e1",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    border: "1px solid #334155",
                    textTransform: "uppercase",
                    marginBottom: "16px",
                  }}
                >
                  Compliance
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
                  Audit-ready by default.
                </h3>
                <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                  Every match, agent investigation step, and human review is logged with verifiable evidence citations.
                </p>
              </div>
              <div style={{ marginTop: "24px", display: "flex", gap: "8px" }}>
                <div
                  style={{
                    backgroundColor: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg style={{ width: "20px", height: "20px", color: "#4ade80", marginBottom: "4px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span style={{ fontSize: "10px", fontWeight: 500, color: "#cbd5e1" }}>Timestamped</span>
                </div>
                <div
                  style={{
                    backgroundColor: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg style={{ width: "20px", height: "20px", color: "#4ade80", marginBottom: "4px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span style={{ fontSize: "10px", fontWeight: 500, color: "#cbd5e1" }}>Verifiable</span>
                </div>
              </div>
            </div>

            {/* Bento 3: Human Oversight (Span 1) */}
            <div
              className="premium-card-hover"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "24px",
                border: "1px solid #f1f5f9",
                padding: "32px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "280px",
                boxSizing: "border-box",
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#fef2f2",
                    color: "#991b1b",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    border: "1px solid #fecaca",
                    textTransform: "uppercase",
                    marginBottom: "16px",
                  }}
                >
                  Control
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                  Human in the loop.
                </h3>
                <p style={{ fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                  AI proposes. You decide. Set strict policy thresholds for automated approvals and sign-offs.
                </p>
              </div>

              <div
                style={{
                  marginTop: "24px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "12px",
                  padding: "16px",
                  border: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                  Require approval &gt; $10k
                </span>
                <div
                  style={{
                    width: "40px",
                    height: "24px",
                    backgroundColor: "#166534",
                    borderRadius: "9999px",
                    position: "relative",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      backgroundColor: "#ffffff",
                      borderRadius: "9999px",
                      position: "absolute",
                      right: "4px",
                      top: "4px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bento 4: Close Package (Span 2) */}
            <div
              className="premium-card-hover"
              style={{
                gridColumn: "span 2",
                background: "linear-gradient(to bottom right, #ffffff, rgba(248, 250, 252, 0.5))",
                borderRadius: "24px",
                border: "1px solid #f1f5f9",
                padding: "40px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                overflow: "hidden",
                minHeight: "280px",
                boxSizing: "border-box",
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#f1f5f9",
                    color: "#475569",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    border: "1px solid #e2e8f0",
                    textTransform: "uppercase",
                    marginBottom: "16px",
                  }}
                >
                  Close Package
                </div>
                <h3 style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                  Autonomous Close Package.
                </h3>
                <p style={{ fontSize: "15px", color: "#64748b", maxWidth: "448px", margin: 0, lineHeight: 1.6 }}>
                  Export verified balance sheet summaries, variance analysis, evidence locker citations, and signed executive memos.
                </p>
              </div>

              <div style={{ marginTop: "32px", display: "flex", gap: "16px", alignItems: "center" }}>
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    padding: "10px 16px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981" }} />
                  <span>Executive PDF</span>
                </div>
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    padding: "10px 16px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#6366f1" }} />
                  <span>Audit JSON</span>
                </div>
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    padding: "10px 16px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                  <span>Evidence Locker</span>
                </div>
                <div style={{ height: "2px", flex: 1, background: "linear-gradient(to right, #e2e8f0, transparent)", marginLeft: "16px" }} />
              </div>
            </div>
          </div>
        </div>

        {/* 6. OPERATIONAL INPUT / START CLOSE SECTION (Judge demo entrypoint) */}
        <div
          ref={startSectionRef}
          style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            marginTop: "96px",
            marginBottom: "64px",
            paddingTop: "40px",
            borderTop: "1px solid rgba(226, 232, 240, 0.6)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "#f1f5f9",
                color: "#475569",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                border: "1px solid #e2e8f0",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              Session Launchpad
            </div>
            <h2
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: "#111",
                marginBottom: "12px",
                letterSpacing: "-0.02em",
              }}
            >
              Start a month-end close
            </h2>
            <p style={{ fontSize: "16px", color: "#64748b", margin: 0 }}>
              Launch the automated close pipeline with our synthetic demo dataset or upload your own reconciliation JSON.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "24px",
            }}
          >
            {/* Option 1: Synthetic Demo Dataset */}
            <div
              className="premium-card-hover"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                border: "1px solid #e2e8f0",
                padding: "32px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxSizing: "border-box",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "#f0fdf4",
                      color: "#166534",
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      fontSize: "11px",
                      fontWeight: 700,
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    Recommended for Demo
                  </div>
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>
                    Period 2024.1
                  </span>
                </div>

                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginBottom: "10px" }}>
                  Synthetic Demo Dataset — 2024.1
                </h3>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5, marginBottom: "20px" }}>
                  Pre-configured month-end reconciliation with 8 bank transactions, 8 ledger entries, and the BT007 anomaly case.
                </p>

                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: "12px",
                    padding: "16px",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    fontSize: "12px",
                    color: "#475569",
                    marginBottom: "24px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Bank Feed Records:</span>
                    <strong style={{ color: "#0f172a" }}>8 items</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>General Ledger Lines:</span>
                    <strong style={{ color: "#0f172a" }}>8 items</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Flagship Case:</span>
                    <strong style={{ color: "#b91c1c" }}>BT007 ($15,000.00 Anomaly)</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={onLoadDemo}
                disabled={isLoading}
                style={{
                  width: "100%",
                  backgroundColor: "#1c1c1c",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 600,
                  padding: "14px 20px",
                  borderRadius: "9999px",
                  border: "none",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "background-color 0.2s ease",
                  opacity: isLoading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = "#000000";
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = "#1c1c1c";
                }}
              >
                {isLoading ? (
                  <span>Running Reconciliation Pipeline...</span>
                ) : (
                  <>
                    <span>Load Demo Dataset</span>
                    <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Option 2: Upload Custom Reconciliation JSON */}
            <div
              className="premium-card-hover"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                border: "1px solid #e2e8f0",
                padding: "32px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxSizing: "border-box",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "#f1f5f9",
                      color: "#475569",
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      fontSize: "11px",
                      fontWeight: 700,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    Custom Ingestion
                  </div>
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>
                    JSON Schema
                  </span>
                </div>

                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", marginBottom: "10px" }}>
                  Upload Reconciliation JSON
                </h3>
                <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5, marginBottom: "20px" }}>
                  Upload any supported ClosePilot reconciliation JSON containing bank transactions and ledger entries.
                </p>

                {/* File Upload Box */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "2px dashed #cbd5e1",
                    borderRadius: "12px",
                    padding: "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    marginBottom: "24px",
                    transition: "border-color 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#94a3b8")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
                >
                  <svg style={{ width: "24px", height: "24px", color: "#64748b", margin: "0 auto 8px auto" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    {fileName ? fileName : "Choose a JSON file or drag it here"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                    Supports month-end close JSON fixtures
                  </div>
                </div>

                {/* Validation Feedback */}
                {validationResult && (
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      marginBottom: "16px",
                      backgroundColor: validationResult.isValid ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${validationResult.isValid ? "#bbf7d0" : "#fecaca"}`,
                      color: validationResult.isValid ? "#166534" : "#991b1b",
                    }}
                  >
                    {validationResult.isValid ? (
                      <div>
                        ✓ Valid schema: {validationResult.datasetLabel || "Custom Dataset"} (
                        {validationResult.summary?.bankTransactionCount || 0} bank,{" "}
                        {validationResult.summary?.ledgerEntryCount || 0} ledger)
                      </div>
                    ) : (
                      <div>
                        <strong>Validation Error:</strong>
                        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                          {validationResult.errors?.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleCustomSubmit}
                disabled={!validationResult?.isValid || isLoading || isProcessingFile}
                style={{
                  width: "100%",
                  backgroundColor: validationResult?.isValid ? "#1c1c1c" : "#f1f5f9",
                  color: validationResult?.isValid ? "#ffffff" : "#94a3b8",
                  fontSize: "15px",
                  fontWeight: 600,
                  padding: "14px 20px",
                  borderRadius: "9999px",
                  border: "none",
                  cursor: validationResult?.isValid && !isLoading ? "pointer" : "not-allowed",
                  boxShadow: validationResult?.isValid ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "background-color 0.2s ease",
                }}
              >
                <span>Run Reconciliation Session</span>
                <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Privacy Message */}
          <div
            style={{
              textAlign: "center",
              marginTop: "24px",
              fontSize: "12px",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span>🔒</span>
            <span>Processed locally in this browser session. Data is not persisted.</span>
          </div>
        </div>

        {/* 7. FOOTER */}
        <footer
          style={{
            borderTop: "1px solid rgba(226, 232, 240, 0.6)",
            paddingTop: "32px",
            paddingBottom: "48px",
            marginTop: "40px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5 }}>
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ color: "#94a3b8", fontSize: "14px", fontWeight: 500, margin: 0 }}>
            © 2026 ClosePilot Inc. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default StartCloseView;
