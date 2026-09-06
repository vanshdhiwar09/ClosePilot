// src/schemas/supporting-document.ts
// TypeScript types and Zod runtime validation for SupportingDocument

import { z } from "zod";

export type SupportingDocument = z.infer<typeof supportingDocumentSchema>;

export const supportingDocumentSchema = z.object({
  id: z.string(),
  documentType: z.enum(["invoice", "receipt", "statement", "other"]),
  fileName: z.string(),
  uri: z.string().min(1), // Supports relative paths (e.g., /documents/...) and full URLs
  sha256: z.string().min(1), // Supports synthetic content hashes and 64-character SHA-256 hashes
  vendor: z.string().optional(),
  amount: z.string().optional(),
  currency: z.string().optional(),
  documentDate: z.string().optional(),
  references: z.array(z.string()).optional(),
  source: z.literal("synthetic_document"),
  sourceRecordId: z.string().optional(),
  schemaVersion: z.literal("1").optional(),
  ingestedAt: z.string().optional(),
});

// Normalized comparison fields
export const normalizeSupportingDocument = (doc: SupportingDocument) => ({
  id: doc.id,
  documentType: doc.documentType,
  fileName: doc.fileName,
  uri: doc.uri,
  sha256: doc.sha256,
  vendor: doc.vendor,
  amount: doc.amount,
  currency: doc.currency,
  documentDate: doc.documentDate,
  references: doc.references,
  normalizedVendor: doc.vendor ? doc.vendor.toLowerCase().trim() : undefined,
});