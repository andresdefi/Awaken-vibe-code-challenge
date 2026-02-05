import { describe, it, expect } from "vitest";
import type { NormalizedTransaction, PerpsTransaction } from "../types";
import { filterByDateRange, DATE_PRESETS } from "../date-filter";

function makeTx(dateStr: string): NormalizedTransaction {
  return {
    id: `tx-${dateStr}`,
    type: "transfer_sent",
    timestamp: new Date(dateStr),
    sentAmount: 1,
    sentCurrency: "ETH",
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: 0.001,
    feeCurrency: "ETH",
    transactionHash: "0x123",
    notes: "",
    tag: "payment",
  };
}

function makePerpsTx(dateStr: string): PerpsTransaction {
  return {
    id: `ptx-${dateStr}`,
    date: new Date(dateStr),
    asset: "BTC",
    amount: 0.1,
    fee: 0.5,
    pnl: 100,
    paymentToken: "USDC",
    notes: "",
    transactionHash: "0x456",
    tag: "close_position",
  };
}

describe("filterByDateRange", () => {
  const txs = [
    makeTx("2024-06-15T10:00:00Z"),
    makeTx("2025-01-10T10:00:00Z"),
    makeTx("2025-06-15T10:00:00Z"),
    makeTx("2025-12-31T23:59:59Z"),
  ];

  it("returns all transactions when no dates provided", () => {
    expect(filterByDateRange(txs, {})).toHaveLength(4);
  });

  it("returns all transactions with empty strings", () => {
    expect(filterByDateRange(txs, { startDate: "", endDate: "" })).toHaveLength(4);
  });

  it("filters by start date only", () => {
    const result = filterByDateRange(txs, { startDate: "2025-01-01" });
    expect(result).toHaveLength(3);
    expect(result.every((tx) => new Date(tx.timestamp) >= new Date("2025-01-01"))).toBe(true);
  });

  it("filters by end date only", () => {
    const result = filterByDateRange(txs, { endDate: "2025-01-31" });
    expect(result).toHaveLength(2);
  });

  it("filters by both start and end date", () => {
    const result = filterByDateRange(txs, { startDate: "2025-01-01", endDate: "2025-06-30" });
    expect(result).toHaveLength(2);
  });

  it("includes transactions on boundary dates (inclusive)", () => {
    const result = filterByDateRange(txs, { startDate: "2025-12-31", endDate: "2025-12-31" });
    expect(result).toHaveLength(1);
  });

  it("works with PerpsTransaction (uses date field)", () => {
    const perpsTxs = [
      makePerpsTx("2024-06-15T10:00:00Z"),
      makePerpsTx("2025-03-15T10:00:00Z"),
    ];
    const result = filterByDateRange(perpsTxs, { startDate: "2025-01-01" });
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no transactions match", () => {
    const result = filterByDateRange(txs, { startDate: "2026-01-01" });
    expect(result).toHaveLength(0);
  });
});

describe("DATE_PRESETS", () => {
  it("has 2025 tax year preset", () => {
    expect(DATE_PRESETS["2025"]).toEqual({ startDate: "2025-01-01", endDate: "2025-12-31" });
  });

  it("has 2024 tax year preset", () => {
    expect(DATE_PRESETS["2024"]).toEqual({ startDate: "2024-01-01", endDate: "2024-12-31" });
  });

  it("has all-time preset with no dates", () => {
    expect(DATE_PRESETS.all).toEqual({});
  });
});
