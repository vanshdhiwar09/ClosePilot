// src/reconciliation/types.ts
// Type definitions for the deterministic reconciliation matching engine.

import { LedgerEntry } from "../schemas/ledger-entry";

export type CandidateClassification =
  | "exact"
  | "strong"
  | "timing_difference"
  | "amount_mismatch"
  | "weak";

export type CandidateLedgerEntry = {
  entry: LedgerEntry;
  classification: CandidateClassification;
  amountDifference: string; // decimal string (e.g., "0.00", "250.00")
  dateDifferenceDays: number;
  referenceMatch: boolean;
  vendorMatch: boolean;
  tokenOverlap: number;
  reasons: string[];
};

export type MatchClassification =
  | "exact_match"
  | "strong_match"
  | "timing_difference"
  | "ambiguous_candidates"
  | "amount_mismatch"
  | "no_candidate";

export type RuleTraceStep = {
  rule: string;
  description: string;
  passed: boolean;
  details: Record<string, unknown>;
};

export type MatchResult = {
  bankTransactionId: string;
  status: MatchClassification;
  selectedMatch?: LedgerEntry;
  candidates: CandidateLedgerEntry[];
  candidateLedgerEntryIds: string[];
  matchedLedgerEntryIds: string[];
  amountDifference: string;
  ruleTrace: RuleTraceStep[];
  confidence: "high" | "medium" | "low";
  requiresReview: boolean;
  configVersion: string;
};

export type MatcherConfig = {
  configVersion?: string;
  exactDateWindowDays?: number; // default: 0 (same day)
  strongDateWindowDays?: number; // default: 2 days
  timingDateWindowDays?: number; // default: 30 days
  vendorAliases?: Record<string, string>;
};
