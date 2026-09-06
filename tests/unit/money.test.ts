// tests/unit/money.test.ts
// Unit tests for deterministic BigInt cents monetary utility

import { describe, it, expect } from "vitest";
import {
  parseCents,
  formatCents,
  absCents,
  addMoney,
  subtractMoney,
  absDifferenceMoney,
  compareMoney,
  isEqualMoney,
  isZeroMoney,
} from "../../src/utils/money";

describe("Deterministic Money Utility (BigInt cents)", () => {
  describe("parseCents", () => {
    it("parses standard 2-decimal positive strings", () => {
      expect(parseCents("1250.00")).toBe(125000n);
      expect(parseCents("0.00")).toBe(0n);
      expect(parseCents("0.05")).toBe(5n);
      expect(parseCents("0.99")).toBe(99n);
      expect(parseCents("15000.00")).toBe(1500000n);
    });

    it("parses negative decimal strings", () => {
      expect(parseCents("-50.25")).toBe(-5025n);
      expect(parseCents("-0.05")).toBe(-5n);
      expect(parseCents("-1250.00")).toBe(-125000n);
    });

    it("handles strings with 1 decimal digit by right-padding with zero", () => {
      expect(parseCents("10.5")).toBe(1050n);
      expect(parseCents("-10.5")).toBe(-1050n);
      expect(parseCents("0.1")).toBe(10n);
    });

    it("handles whole integer strings without decimals", () => {
      expect(parseCents("100")).toBe(10000n);
      expect(parseCents("0")).toBe(0n);
      expect(parseCents("-5")).toBe(-500n);
      expect(parseCents("+250")).toBe(25000n);
    });

    it("handles explicit positive sign", () => {
      expect(parseCents("+1250.00")).toBe(125000n);
    });

    it("handles zero with various formats", () => {
      expect(parseCents("0.00")).toBe(0n);
      expect(parseCents("-0.00")).toBe(0n);
      expect(parseCents("+0.00")).toBe(0n);
      expect(parseCents("0")).toBe(0n);
    });

    it("handles large amounts without precision loss", () => {
      // Numbers larger than Number.MAX_SAFE_INTEGER
      const largeDecimal = "9007199254740992.55";
      const expectedCents = 900719925474099255n;
      expect(parseCents(largeDecimal)).toBe(expectedCents);
    });

    it("rejects malformed monetary inputs", () => {
      expect(() => parseCents("")).toThrow("Invalid monetary amount format");
      expect(() => parseCents("   ")).toThrow("Invalid monetary amount format");
      expect(() => parseCents("abc")).toThrow("Invalid monetary amount format");
      expect(() => parseCents("$1250.00")).toThrow("Invalid monetary amount format");
      expect(() => parseCents("1,250.00")).toThrow("Invalid monetary amount format");
      expect(() => parseCents("12.345")).toThrow("Invalid monetary amount format");
      expect(() => parseCents("--50.00")).toThrow("Invalid monetary amount format");
      expect(() => parseCents("50..00")).toThrow("Invalid monetary amount format");
      expect(() => parseCents("12.0.0")).toThrow("Invalid monetary amount format");
      expect(() => parseCents(null as any)).toThrow("Monetary amount must be a string");
      expect(() => parseCents(undefined as any)).toThrow("Monetary amount must be a string");
      expect(() => parseCents(1250 as any)).toThrow("Monetary amount must be a string");
    });
  });

  describe("formatCents", () => {
    it("formats positive cents to 2-decimal string", () => {
      expect(formatCents(125000n)).toBe("1250.00");
      expect(formatCents(0n)).toBe("0.00");
      expect(formatCents(5n)).toBe("0.05");
      expect(formatCents(50n)).toBe("0.50");
      expect(formatCents(99n)).toBe("0.99");
      expect(formatCents(100n)).toBe("1.00");
    });

    it("formats negative cents to 2-decimal string with negative sign", () => {
      expect(formatCents(-5025n)).toBe("-50.25");
      expect(formatCents(-5n)).toBe("-0.05");
      expect(formatCents(-50n)).toBe("-0.50");
      expect(formatCents(-125000n)).toBe("-1250.00");
    });

    it("rejects non-bigint inputs", () => {
      expect(() => formatCents(1250 as any)).toThrow("Cents must be a bigint");
      expect(() => formatCents("1250" as any)).toThrow("Cents must be a bigint");
    });
  });

  describe("absCents", () => {
    it("returns absolute value of BigInt cents", () => {
      expect(absCents(100n)).toBe(100n);
      expect(absCents(-100n)).toBe(100n);
      expect(absCents(0n)).toBe(0n);
    });
  });

  describe("addMoney", () => {
    it("adds monetary decimal strings deterministically", () => {
      expect(addMoney("1250.00", "250.50")).toBe("1500.50");
      expect(addMoney("0.05", "0.05")).toBe("0.10");
      expect(addMoney("-50.00", "100.00")).toBe("50.00");
      expect(addMoney("-50.00", "-50.00")).toBe("-100.00");
    });
  });

  describe("subtractMoney", () => {
    it("subtracts monetary decimal strings deterministically", () => {
      expect(subtractMoney("1250.00", "0.00")).toBe("1250.00");
      expect(subtractMoney("0.00", "1250.00")).toBe("-1250.00");
      expect(subtractMoney("2500.00", "2750.00")).toBe("-250.00");
      expect(subtractMoney("100.00", "0.01")).toBe("99.99");
    });
  });

  describe("absDifferenceMoney", () => {
    it("returns absolute difference", () => {
      expect(absDifferenceMoney("2500.00", "2750.00")).toBe("250.00");
      expect(absDifferenceMoney("2750.00", "2500.00")).toBe("250.00");
      expect(absDifferenceMoney("1250.00", "1250.00")).toBe("0.00");
    });
  });

  describe("compareMoney", () => {
    it("returns -1 when a < b", () => {
      expect(compareMoney("100.00", "200.00")).toBe(-1);
      expect(compareMoney("-10.00", "0.00")).toBe(-1);
    });

    it("returns 1 when a > b", () => {
      expect(compareMoney("200.00", "100.00")).toBe(1);
      expect(compareMoney("0.00", "-10.00")).toBe(1);
    });

    it("returns 0 when a === b", () => {
      expect(compareMoney("100.00", "100.00")).toBe(0);
      expect(compareMoney("0.00", "-0.00")).toBe(0);
      expect(compareMoney("10.5", "10.50")).toBe(0);
    });
  });

  describe("isEqualMoney", () => {
    it("checks equality regardless of padding or sign quirks", () => {
      expect(isEqualMoney("100.00", "100.00")).toBe(true);
      expect(isEqualMoney("100", "100.00")).toBe(true);
      expect(isEqualMoney("10.5", "10.50")).toBe(true);
      expect(isEqualMoney("0.00", "-0.00")).toBe(true);
      expect(isEqualMoney("100.00", "100.01")).toBe(false);
    });
  });

  describe("isZeroMoney", () => {
    it("checks if monetary amount is zero", () => {
      expect(isZeroMoney("0.00")).toBe(true);
      expect(isZeroMoney("0")).toBe(true);
      expect(isZeroMoney("-0.00")).toBe(true);
      expect(isZeroMoney("+0.00")).toBe(true);
      expect(isZeroMoney("0.01")).toBe(false);
      expect(isZeroMoney("-0.01")).toBe(false);
    });
  });
});
