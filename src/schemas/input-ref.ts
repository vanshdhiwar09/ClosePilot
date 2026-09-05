// src/schemas/input-ref.ts
// TypeScript types for input references used by the fixture loader

// Reference types for fixture loader
export type InputRef = {
  // Bank transaction reference
  bank: string; // fixture key or ID
  // Ledger entry reference
  ledger: string;
  // Document reference
  documents: string[];
  // Chart of accounts reference
  chartOfAccounts: string;
};

// Fixture metadata
export type FixtureMetadata = {
  fixtureVersion: string;
  description: string;
  createdAt: string;
  recordCount: {
    bankTransactions: number;
    ledgerEntries: number;
    documents: number;
    chartOfAccounts: number;
  };
};