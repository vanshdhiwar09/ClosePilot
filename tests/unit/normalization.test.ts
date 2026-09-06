// tests/unit/normalization.test.ts
// Unit tests for deterministic text, reference, and vendor normalization.

import { describe, it, expect } from "vitest";
import {
  normalizeText,
  normalizeReference,
  normalizeVendor,
  tokenizeText,
  computeTokenOverlap,
} from "../../src/reconciliation/normalize";

describe("Deterministic Normalization Utilities", () => {
  describe("normalizeText", () => {
    it("lowercases, trims, and collapses whitespace", () => {
      expect(normalizeText("  Invoice   Payment  To Vendor A  ")).toBe("invoice payment to vendor a");
      expect(normalizeText("Hello\tWorld\n")).toBe("hello world");
      expect(normalizeText("")).toBe("");
      expect(normalizeText(undefined)).toBe("");
      expect(normalizeText(null)).toBe("");
    });
  });

  describe("normalizeReference", () => {
    it("uppercases and trims financial references", () => {
      expect(normalizeReference("inv-001")).toBe("INV-001");
      expect(normalizeReference("  large-001  ")).toBe("LARGE-001");
      expect(normalizeReference("ref 002")).toBe("REF 002");
    });

    it("returns undefined for empty references", () => {
      expect(normalizeReference("")).toBeUndefined();
      expect(normalizeReference("   ")).toBeUndefined();
      expect(normalizeReference(undefined)).toBeUndefined();
      expect(normalizeReference(null)).toBeUndefined();
    });
  });

  describe("normalizeVendor", () => {
    it("lowercases and strips common legal suffixes", () => {
      expect(normalizeVendor("Vendor A, Inc.")).toBe("vendor a");
      expect(normalizeVendor("Vendor B LLC")).toBe("vendor b");
      expect(normalizeVendor("Vendor C Corp")).toBe("vendor c");
      expect(normalizeVendor("Vendor D Ltd.")).toBe("vendor d");
      expect(normalizeVendor("Vendor E Company")).toBe("vendor e");
    });

    it("applies vendor alias dictionary if provided", () => {
      const aliases = {
        "acme supply": "acme corporation",
        "aws cloud": "amazon web services",
      };
      expect(normalizeVendor("Acme Supply", aliases)).toBe("acme corporation");
      expect(normalizeVendor("AWS Cloud", aliases)).toBe("amazon web services");
      expect(normalizeVendor("Unknown Vendor", aliases)).toBe("unknown vendor");
    });

    it("returns undefined for missing vendor values", () => {
      expect(normalizeVendor("")).toBeUndefined();
      expect(normalizeVendor("   ")).toBeUndefined();
      expect(normalizeVendor(undefined)).toBeUndefined();
    });
  });

  describe("tokenizeText", () => {
    it("extracts unique keywords while filtering stop words", () => {
      const tokens = tokenizeText("Invoice payment to Vendor A for consulting services");
      expect(tokens).toContain("vendor");
      expect(tokens).toContain("consulting");
      expect(tokens).toContain("services");
      // Stop words filtered out
      expect(tokens).not.toContain("to");
      expect(tokens).not.toContain("for");
      expect(tokens).not.toContain("invoice");
      expect(tokens).not.toContain("payment");
    });

    it("returns empty array for empty inputs", () => {
      expect(tokenizeText("")).toEqual([]);
      expect(tokenizeText(undefined)).toEqual([]);
    });
  });

  describe("computeTokenOverlap", () => {
    it("computes overlapping token count between two descriptions", () => {
      const a = "Monthly subscription cloud hosting platform";
      const b = "Cloud hosting renewal bill";
      expect(computeTokenOverlap(a, b)).toBe(2); // "cloud", "hosting"
    });

    it("returns 0 when no tokens overlap", () => {
      expect(computeTokenOverlap("Office supplies stationery", "Software license key")).toBe(0);
    });
  });
});
