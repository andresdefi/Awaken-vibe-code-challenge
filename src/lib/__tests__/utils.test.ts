import { describe, it, expect } from "vitest";
import { formatDate, formatAmount, truncateAddress, cn } from "../utils";

describe("formatDate", () => {
  it("formats a UTC date with zero-padding", () => {
    const date = new Date("2024-03-05T08:02:09Z");
    expect(formatDate(date)).toBe("03/05/2024 08:02:09");
  });

  it("handles end-of-year date", () => {
    const date = new Date("2025-12-31T23:59:59Z");
    expect(formatDate(date)).toBe("12/31/2025 23:59:59");
  });

  it("handles epoch zero", () => {
    const date = new Date("1970-01-01T00:00:00Z");
    expect(formatDate(date)).toBe("01/01/1970 00:00:00");
  });
});

describe("formatAmount", () => {
  it("formats integer amounts without trailing zeros", () => {
    expect(formatAmount(100)).toBe("100");
  });

  it("preserves significant decimals", () => {
    expect(formatAmount(1.23456789)).toBe("1.23456789");
  });

  it("trims trailing zeros", () => {
    expect(formatAmount(1.5)).toBe("1.5");
  });

  it("handles zero", () => {
    expect(formatAmount(0)).toBe("0");
  });

  it("uses custom decimal precision", () => {
    expect(formatAmount(1.123456789, 4)).toBe("1.1235");
  });

  it("handles very small amounts", () => {
    expect(formatAmount(0.00000001)).toBe("0.00000001");
  });
});

describe("truncateAddress", () => {
  it("truncates with default chars", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    expect(truncateAddress(addr)).toBe("0x1234...345678");
  });

  it("truncates with custom chars", () => {
    const addr = "dydx1abc123def456";
    expect(truncateAddress(addr, 4)).toBe("dydx...f456");
  });

  it("returns empty string for empty input", () => {
    expect(truncateAddress("")).toBe("");
  });
});

describe("cn", () => {
  it("merges Tailwind classes", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});
