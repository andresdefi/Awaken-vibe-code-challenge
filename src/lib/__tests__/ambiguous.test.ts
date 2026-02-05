import { describe, it, expect } from "vitest";
import type { NormalizedTransaction, PerpsTransaction } from "../types";
import { flagAmbiguousTransactions, flagAmbiguousPerpsTransactions } from "../ambiguous";

function makeTx(overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return {
    id: "tx-1",
    type: "transfer_sent",
    timestamp: new Date("2025-01-15T10:00:00Z"),
    sentAmount: 1,
    sentCurrency: "ETH",
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: 0.001,
    feeCurrency: "ETH",
    transactionHash: "0x123",
    notes: "",
    tag: "payment",
    ...overrides,
  };
}

function makePerpsTx(overrides: Partial<PerpsTransaction> = {}): PerpsTransaction {
  return {
    id: "ptx-1",
    date: new Date("2025-02-01T12:00:00Z"),
    asset: "BTC",
    amount: 0.1,
    fee: 0.5,
    pnl: 100,
    paymentToken: "USDC",
    notes: "",
    transactionHash: "0x456",
    tag: "close_position",
    ...overrides,
  };
}

describe("flagAmbiguousTransactions", () => {
  it("returns empty array for empty input", () => {
    expect(flagAmbiguousTransactions([])).toEqual([]);
  });

  it("flags missing fiat price when others have prices", () => {
    const txs = [
      makeTx({ id: "1", fiatPrice: 3000 }),
      makeTx({ id: "2", fiatPrice: 0 }),
    ];
    const result = flagAmbiguousTransactions(txs);
    expect(result[0].isAmbiguous).toBeUndefined();
    expect(result[1].isAmbiguous).toBe(true);
    expect(result[1].ambiguousReasons).toContain("Missing fiat price");
  });

  it("does not flag missing fiat price when no txs have prices", () => {
    const txs = [
      makeTx({ id: "1", fiatPrice: 0 }),
      makeTx({ id: "2", fiatPrice: undefined }),
    ];
    const result = flagAmbiguousTransactions(txs);
    expect(result.every((tx) => !tx.isAmbiguous)).toBe(true);
  });

  it("flags zero amount with fees", () => {
    const txs = [
      makeTx({ sentAmount: 0, receivedAmount: null, feeAmount: 0.01 }),
    ];
    const result = flagAmbiguousTransactions(txs);
    expect(result[0].isAmbiguous).toBe(true);
    expect(result[0].ambiguousReasons).toContain(
      "Zero value with fees (possible approval or failed tx)"
    );
  });

  it("flags self-transfers", () => {
    const txs = [
      makeTx({
        sentAmount: 1,
        sentCurrency: "ETH",
        receivedAmount: 1,
        receivedCurrency: "ETH",
      }),
    ];
    const result = flagAmbiguousTransactions(txs);
    expect(result[0].isAmbiguous).toBe(true);
    expect(result[0].ambiguousReasons).toContain(
      "Self-transfer (same currency sent and received)"
    );
  });

  it("does not flag normal sent+received with different currencies", () => {
    const txs = [
      makeTx({
        sentAmount: 1,
        sentCurrency: "ETH",
        receivedAmount: 3000,
        receivedCurrency: "USDC",
      }),
    ];
    const result = flagAmbiguousTransactions(txs);
    expect(result[0].isAmbiguous).toBeUndefined();
  });

  it("flags statistical outlier amounts (>3 std devs, min 5 txs)", () => {
    // 20 normal txs at amount=1, plus one extreme outlier — need many normal values
    // so the outlier exceeds 3 stddevs even when included in the calculation
    const txs = Array.from({ length: 20 }, (_, i) =>
      makeTx({ id: String(i + 1), sentAmount: 1 })
    );
    txs.push(makeTx({ id: "outlier", sentAmount: 100 }));
    const result = flagAmbiguousTransactions(txs);
    const outlier = result.find((tx) => tx.id === "outlier");
    expect(outlier?.isAmbiguous).toBe(true);
    expect(outlier?.ambiguousReasons).toContain("Unusual amount (statistical outlier)");
  });

  it("does not flag outliers with fewer than 5 transactions", () => {
    const txs = [
      makeTx({ id: "1", sentAmount: 1 }),
      makeTx({ id: "2", sentAmount: 1000 }),
    ];
    const result = flagAmbiguousTransactions(txs);
    expect(result.every((tx) => !tx.ambiguousReasons?.includes("Unusual amount (statistical outlier)"))).toBe(true);
  });

  it("can flag multiple reasons on one transaction", () => {
    // tx 6: self-transfer (same currency sent/received) + missing fiat price
    const txs = [
      makeTx({ id: "1", fiatPrice: 3000 }),
      makeTx({ id: "2", fiatPrice: 3000 }),
      makeTx({
        id: "6",
        fiatPrice: 0,
        sentAmount: 1,
        sentCurrency: "ETH",
        receivedAmount: 1,
        receivedCurrency: "ETH",
      }),
    ];
    const result = flagAmbiguousTransactions(txs);
    const flagged = result.find((tx) => tx.id === "6");
    expect(flagged?.isAmbiguous).toBe(true);
    expect(flagged?.ambiguousReasons).toContain("Missing fiat price");
    expect(flagged?.ambiguousReasons).toContain("Self-transfer (same currency sent and received)");
    expect(flagged?.ambiguousReasons?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("flagAmbiguousPerpsTransactions", () => {
  it("returns empty array for empty input", () => {
    expect(flagAmbiguousPerpsTransactions([])).toEqual([]);
  });

  it("flags zero P&L on close position", () => {
    const txs = [makePerpsTx({ pnl: 0, tag: "close_position" })];
    const result = flagAmbiguousPerpsTransactions(txs);
    expect(result[0].isAmbiguous).toBe(true);
    expect(result[0].ambiguousReasons).toContain("Zero P&L on close position");
  });

  it("does not flag zero P&L on open position", () => {
    const txs = [makePerpsTx({ pnl: 0, tag: "open_position" })];
    const result = flagAmbiguousPerpsTransactions(txs);
    expect(result[0].isAmbiguous).toBeUndefined();
  });

  it("flags P&L outliers (>3 std devs, min 5 txs)", () => {
    // 20 normal P&L values near 10, plus one extreme outlier
    const txs = Array.from({ length: 20 }, (_, i) =>
      makePerpsTx({ id: String(i + 1), pnl: 10 + (i % 3) - 1 })
    );
    txs.push(makePerpsTx({ id: "outlier", pnl: 50000 }));
    const result = flagAmbiguousPerpsTransactions(txs);
    const outlier = result.find((tx) => tx.id === "outlier");
    expect(outlier?.isAmbiguous).toBe(true);
    expect(outlier?.ambiguousReasons).toContain("Unusual P&L (statistical outlier)");
  });

  it("does not flag P&L outliers with fewer than 5 non-zero P&L txs", () => {
    const txs = [
      makePerpsTx({ id: "1", pnl: 10 }),
      makePerpsTx({ id: "2", pnl: 50000 }),
    ];
    const result = flagAmbiguousPerpsTransactions(txs);
    expect(result.every((tx) => !tx.ambiguousReasons?.includes("Unusual P&L (statistical outlier)"))).toBe(true);
  });
});
