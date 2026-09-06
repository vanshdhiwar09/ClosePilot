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

/**
 * Normalizes user-uploaded or loosely structured document payloads into strict SupportingDocument schema.
 */
export function normalizeSupportingDocumentInput(rawDoc: any, index = 0): SupportingDocument {
  if (!rawDoc || typeof rawDoc !== "object") {
    const id = `DOC-${index + 1}`;
    return {
      id,
      documentType: "invoice",
      fileName: `${id}.pdf`,
      uri: `/documents/${id}.pdf`,
      sha256: `sha256:${id}`,
      source: "synthetic_document",
      schemaVersion: "1",
    };
  }

  const id = String(rawDoc.id || `DOC-${index + 1}`);
  const rawType = String(rawDoc.documentType || rawDoc.type || "invoice").toLowerCase();
  const documentType = ["invoice", "receipt", "statement", "other"].includes(rawType)
    ? (rawType as "invoice" | "receipt" | "statement" | "other")
    : "invoice";

  const fileName = rawDoc.fileName || `${id}.pdf`;
  const uri = rawDoc.uri || `/documents/${fileName}`;
  const sha256 = rawDoc.sha256 || rawDoc.rawHash || `sha256:${id}`;

  let amountStr: string | undefined = undefined;
  if (rawDoc.amount !== undefined && rawDoc.amount !== null) {
    if (typeof rawDoc.amount === "number") {
      amountStr = rawDoc.amount.toFixed(2);
    } else {
      amountStr = String(rawDoc.amount);
    }
  }

  let references: string[] | undefined = undefined;
  if (Array.isArray(rawDoc.references)) {
    references = rawDoc.references.map(String);
  } else if (rawDoc.reference) {
    references = [String(rawDoc.reference)];
  }

  return {
    id,
    documentType,
    fileName,
    uri,
    sha256,
    vendor: rawDoc.vendor ? String(rawDoc.vendor) : undefined,
    amount: amountStr,
    currency: rawDoc.currency ? String(rawDoc.currency) : "USD",
    documentDate: rawDoc.documentDate || rawDoc.date || undefined,
    references,
    source: "synthetic_document",
    sourceRecordId: rawDoc.sourceRecordId ? String(rawDoc.sourceRecordId) : id,
    schemaVersion: "1",
    ingestedAt: rawDoc.ingestedAt || new Date().toISOString(),
  };
}