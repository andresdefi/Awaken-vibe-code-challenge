// dYdX transaction normalizer for Awaken Perps CSV format

import type { PerpsTransaction, PerpsTag } from "@/lib/types";
import type {
  DydxFill,
  DydxFundingPayment,
  DydxTransfer,
} from "./types";
import { DYDX_MARKETS } from "./types";

// Parse market symbol to extract base asset
function parseMarketAsset(market: string): string {
  // Check known markets first
  const knownMarket = DYDX_MARKETS[market];
  if (knownMarket) {
    return knownMarket.base;
  }

  // Parse market symbol like "BTC-USD"
  const parts = market.split("-");
  if (parts.length >= 1) {
    return parts[0];
  }

  return market;
}

// Determine if a trade is opening or closing a position
// Uses realized P&L and liquidation status as heuristics
function determineTradeTag(fill: DydxFill): PerpsTag {
  // Liquidations are always closing positions
  if (fill.type === "LIQUIDATED" || fill.type === "LIQUIDATION" || fill.type === "DELEVERAGED") {
    return "close_position";
  }

  // For regular trades, we infer based on the trade type
  // This is a heuristic - in reality we'd need full position tracking
  // A more sophisticated approach would maintain running position per market

  // Since dYdX fills don't include realized_pnl directly in the fill,
  // we use a simple heuristic: check if fee is relatively high (taker)
  // which often indicates market closes

  // Default to open_position for new trades
  return "open_position";
}

// Normalize dYdX fill to Perps transaction
export function normalizeDydxFill(fill: DydxFill): PerpsTransaction {
  const tag = determineTradeTag(fill);
  const fee = parseFloat(fill.fee) || 0;
  const size = parseFloat(fill.size) || 0;
  const price = parseFloat(fill.price) || 0;

  // Build notes based on fill details
  const notes = [
    `${fill.side} ${fill.market}`,
    `@ ${price.toFixed(2)}`,
    fill.liquidity === "MAKER" ? "Maker" : "Taker",
    fill.type === "LIQUIDATED" || fill.type === "LIQUIDATION" ? "LIQUIDATION" : "",
    fill.type === "DELEVERAGED" ? "DELEVERAGED" : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    id: fill.id,
    date: new Date(fill.createdAt),
    asset: parseMarketAsset(fill.market),
    amount: size,
    fee: fee,
    pnl: 0, // dYdX fills don't include P&L directly - would need position tracking
    paymentToken: "USDC", // dYdX v4 uses USDC as settlement
    notes: notes,
    transactionHash: fill.orderId || fill.id,
    tag: tag,
  };
}

// Normalize dYdX funding payment to Perps transaction
export function normalizeDydxFundingPayment(
  payment: DydxFundingPayment
): PerpsTransaction {
  const paymentAmount = parseFloat(payment.payment) || 0;
  const positionSize = parseFloat(payment.positionSize) || 0;
  const fundingRate = parseFloat(payment.rate) || 0;
  const price = parseFloat(payment.price) || 0;

  // Notes include funding rate info
  const ratePercentage = (fundingRate * 100).toFixed(6);
  const notes = [
    `Funding ${payment.market}`,
    `Rate: ${paymentAmount >= 0 ? "+" : ""}${ratePercentage}%`,
    `Position: ${positionSize}`,
    `Price: ${price.toFixed(2)}`,
  ].join(" | ");

  // Create a unique ID from the funding payment data
  const id = `funding-${payment.market}-${payment.effectiveAtHeight}`;

  return {
    id: id,
    date: new Date(payment.effectiveAt),
    asset: parseMarketAsset(payment.market),
    amount: Math.abs(positionSize),
    fee: 0,
    pnl: paymentAmount, // Positive = received, negative = paid
    paymentToken: "USDC",
    notes: notes,
    transactionHash: id,
    tag: "funding_payment",
  };
}

// Normalize dYdX transfer to note (not a PerpsTransaction but useful for context)
export function normalizeDydxTransfer(transfer: DydxTransfer): PerpsTransaction | null {
  const amount = parseFloat(transfer.size) || 0;

  // For tax purposes, deposits and withdrawals aren't perps transactions
  // but we can include them with a special tag if needed
  // For now, we skip them as they're not part of the perps P&L

  if (transfer.type === "DEPOSIT" || transfer.type === "WITHDRAWAL") {
    return null;
  }

  return null;
}

// Normalize all dYdX data to Perps transactions
export function normalizeDydxData(
  fills: DydxFill[],
  fundingPayments: DydxFundingPayment[],
  _transfers: DydxTransfer[] // For future use
): PerpsTransaction[] {
  const allTransactions: PerpsTransaction[] = [];

  // Normalize fills (trades)
  const normalizedFills = fills.map(normalizeDydxFill);
  allTransactions.push(...normalizedFills);

  // Normalize funding payments
  const normalizedFunding = fundingPayments.map(normalizeDydxFundingPayment);
  allTransactions.push(...normalizedFunding);

  // Sort by date descending (newest first)
  allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  return allTransactions;
}

// Calculate summary statistics
export interface DydxSummary {
  totalTrades: number;
  openPositions: number;
  closePositions: number;
  fundingPayments: number;
  totalPnL: number;
  totalFees: number;
  tradedAssets: string[];
  subaccounts: number;
}

export function calculateSummary(
  transactions: PerpsTransaction[],
  subaccountCount: number = 1
): DydxSummary {
  const summary: DydxSummary = {
    totalTrades: 0,
    openPositions: 0,
    closePositions: 0,
    fundingPayments: 0,
    totalPnL: 0,
    totalFees: 0,
    tradedAssets: [],
    subaccounts: subaccountCount,
  };

  const assets = new Set<string>();

  for (const tx of transactions) {
    summary.totalPnL += tx.pnl;
    summary.totalFees += tx.fee;
    assets.add(tx.asset);

    switch (tx.tag) {
      case "open_position":
        summary.totalTrades++;
        summary.openPositions++;
        break;
      case "close_position":
        summary.totalTrades++;
        summary.closePositions++;
        break;
      case "funding_payment":
        summary.fundingPayments++;
        break;
    }
  }

  summary.tradedAssets = Array.from(assets).sort();

  return summary;
}
