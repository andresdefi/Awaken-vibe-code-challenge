import { describe, it, expect } from "vitest";
import type { NormalizedTransaction, PerpsTransaction } from "../types";
import {
  transactionToAwakenRow,
  generateAwakenCSV,
  perpsTransactionToAwakenRow,
  generateAwakenPerpsCSV,
} from "../csv";

function makeTx(overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction {
  return {
    id: "tx-1",
    type: "transfer_sent",
    timestamp: new Date("2025-01-15T10:30:00Z"),
    sentAmount: 1.5,
    sentCurrency: "ETH",
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: 0.001,
    feeCurrency: "ETH",
    transactionHash: "0xabc123",
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
    pnl: 150.25,
    paymentToken: "USDC",
    notes: "",
    transactionHash: "0xdef456",
    tag: "close_position",
    ...overrides,
  };
}

describe("transactionToAwakenRow", () => {
  it("maps all fields correctly", () => {
    const row = transactionToAwakenRow(makeTx());
    expect(row.Date).toBe("01/15/2025 10:30:00");
    expect(row["Sent Quantity"]).toBe("1.5");
    expect(row["Sent Currency"]).toBe("ETH");
    expect(row["Received Quantity"]).toBe("");
    expect(row["Received Currency"]).toBe("");
    expect(row["Fee Amount"]).toBe("0.001");
    expect(row["Fee Currency"]).toBe("ETH");
    expect(row["Transaction Hash"]).toBe("0xabc123");
    expect(row.Tag).toBe("payment");
  });

  it("handles null amounts", () => {
    const row = transactionToAwakenRow(makeTx({ sentAmount: null, sentCurrency: null }));
    expect(row["Sent Quantity"]).toBe("");
    expect(row["Sent Currency"]).toBe("");
  });

  it("calculates fiat amount", () => {
    const row = transactionToAwakenRow(makeTx({ sentAmount: 2, fiatPrice: 3000 }));
    expect(row["Sent Fiat Amount"]).toBe("6000.00");
  });

  it("appends REVIEW note for ambiguous transactions", () => {
    const row = transactionToAwakenRow(
      makeTx({
        isAmbiguous: true,
        ambiguousReasons: ["Missing fiat price", "Self-transfer"],
        notes: "Original note",
      })
    );
    expect(row.Notes).toBe("Original note [REVIEW: Missing fiat price; Self-transfer]");
  });

  it("does not append REVIEW for non-ambiguous transactions", () => {
    const row = transactionToAwakenRow(makeTx({ notes: "Just a note" }));
    expect(row.Notes).toBe("Just a note");
  });
});

describe("generateAwakenCSV", () => {
  it("generates header row", () => {
    const csv = generateAwakenCSV([]);
    expect(csv).toBe(
      "Date,Received Quantity,Received Currency,Received Fiat Amount,Sent Quantity,Sent Currency,Sent Fiat Amount,Fee Amount,Fee Currency,Transaction Hash,Notes,Tag"
    );
  });

  it("generates rows for transactions", () => {
    const csv = generateAwakenCSV([makeTx()]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("01/15/2025");
    expect(lines[1]).toContain("payment");
  });

  it("escapes commas and quotes in fields", () => {
    const csv = generateAwakenCSV([makeTx({ notes: 'Has "quotes" and, commas' })]);
    expect(csv).toContain('"Has ""quotes"" and, commas"');
  });
});

describe("perpsTransactionToAwakenRow", () => {
  it("formats positive P&L with + prefix", () => {
    const row = perpsTransactionToAwakenRow(makePerpsTx({ pnl: 100 }));
    expect(row["P&L"]).toBe("+100");
  });

  it("formats negative P&L", () => {
    const row = perpsTransactionToAwakenRow(makePerpsTx({ pnl: -50.123 }));
    expect(row["P&L"]).toBe("-50.123");
  });

  it("formats zero P&L", () => {
    const row = perpsTransactionToAwakenRow(makePerpsTx({ pnl: 0 }));
    expect(row["P&L"]).toBe("0");
  });

  it("maps all perps fields", () => {
    const row = perpsTransactionToAwakenRow(makePerpsTx());
    expect(row.Asset).toBe("BTC");
    expect(row.Amount).toBe("0.1");
    expect(row.Fee).toBe("0.5");
    expect(row["Payment Token"]).toBe("USDC");
    expect(row.Tag).toBe("close_position");
  });

  it("appends REVIEW note for ambiguous perps transactions", () => {
    const row = perpsTransactionToAwakenRow(
      makePerpsTx({
        isAmbiguous: true,
        ambiguousReasons: ["Zero P&L on close position"],
      })
    );
    expect(row.Notes).toBe("[REVIEW: Zero P&L on close position]");
  });
});

describe("generateAwakenPerpsCSV", () => {
  it("generates perps header row", () => {
    const csv = generateAwakenPerpsCSV([]);
    expect(csv).toBe("Date,Asset,Amount,Fee,P&L,Payment Token,Notes,Transaction Hash,Tag");
  });

  it("generates data rows", () => {
    const csv = generateAwakenPerpsCSV([makePerpsTx()]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("BTC");
  });
});
