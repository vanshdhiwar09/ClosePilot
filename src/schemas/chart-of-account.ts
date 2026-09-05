// src/schemas/chart-of-account.ts
// TypeScript types and Zod runtime validation for ChartOfAccount

import { z } from "zod";

export type ChartOfAccount = z.infer<typeof chartOfAccountSchema>;

export const chartOfAccountSchema = z.object({
  accountId: z.string(),
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  active: z.boolean(),
  currency: z.string().optional(),
});

// Normalized comparison fields
export const normalizeChartOfAccount = (account: ChartOfAccount) => ({
  accountId: account.accountId,
  accountCode: account.accountCode,
  accountName: account.accountName,
  accountType: account.accountType,
  active: account.active,
  currency: account.currency,
});