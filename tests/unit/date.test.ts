// tests/unit/date.test.ts
// Unit tests for deterministic calendar date difference calculations.

import { describe, it, expect } from "vitest";
import {
  parseDateUTC,
  calculateDateDifferenceDays,
  isWithinDateWindow,
} from "../../src/reconciliation/date";

describe("Deterministic Date Calculations", () => {
  describe("parseDateUTC", () => {
    it("parses valid YYYY-MM-DD date into UTC midnight milliseconds", () => {
      const ms = parseDateUTC("2024-01-15");
      expect(ms).toBe(Date.UTC(2024, 0, 15));
    });

    it("rejects malformed date formats", () => {
      expect(() => parseDateUTC("2024/01/15")).toThrow("Invalid date format");
      expect(() => parseDateUTC("01-15-2024")).toThrow("Invalid date format");
      expect(() => parseDateUTC("2024-1-15")).toThrow("Invalid date format");
      expect(() => parseDateUTC("invalid")).toThrow("Invalid date format");
      expect(() => parseDateUTC("2024-13-01")).toThrow("Invalid calendar date values");
      expect(() => parseDateUTC("2024-00-10")).toThrow("Invalid calendar date values");
    });
  });

  describe("calculateDateDifferenceDays", () => {
    it("returns 0 for the exact same date", () => {
      expect(calculateDateDifferenceDays("2024-01-15", "2024-01-15")).toBe(0);
    });

    it("calculates difference for adjacent dates", () => {
      expect(calculateDateDifferenceDays("2024-01-15", "2024-01-16")).toBe(1);
      expect(calculateDateDifferenceDays("2024-01-16", "2024-01-15")).toBe(1);
    });

    it("calculates difference across month boundaries", () => {
      // 2024 is a leap year (Feb has 29 days)
      expect(calculateDateDifferenceDays("2024-01-31", "2024-02-01")).toBe(1);
      expect(calculateDateDifferenceDays("2024-02-28", "2024-03-01")).toBe(2);
    });

    it("calculates large multi-week differences correctly", () => {
      expect(calculateDateDifferenceDays("2024-01-01", "2024-01-31")).toBe(30);
    });
  });

  describe("isWithinDateWindow", () => {
    it("returns true when difference is within window", () => {
      expect(isWithinDateWindow("2024-01-15", "2024-01-15", 0)).toBe(true);
      expect(isWithinDateWindow("2024-01-15", "2024-01-16", 1)).toBe(true);
      expect(isWithinDateWindow("2024-01-15", "2024-01-17", 2)).toBe(true);
    });

    it("returns false when difference exceeds window", () => {
      expect(isWithinDateWindow("2024-01-15", "2024-01-16", 0)).toBe(false);
      expect(isWithinDateWindow("2024-01-15", "2024-01-18", 2)).toBe(false);
    });

    it("throws for negative window values", () => {
      expect(() => isWithinDateWindow("2024-01-15", "2024-01-15", -1)).toThrow("maxDays must be non-negative");
    });
  });
});
