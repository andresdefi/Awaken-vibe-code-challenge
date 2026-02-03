// Extended transaction normalizer for Awaken Perps CSV format

import type { PerpsTransaction, PerpsTag } from "@/lib/types";
import type {
  ExtendedTrade,
  ExtendedFundingPayment,
  ExtendedAssetOperation,
} from "./types";
import { EXTENDED_MARKETS } from "./types";

// Parse market symbol to extract base asset
function parseMarketAsset(market: string): string {
  // Check known markets first
  const knownMarket = EXTENDED_MARKETS[market];
  if (knownMarket) {
    return knownMarket.base;
  }

  // Parse market symbol like "BTC-USD-PERP" or "ETH-USDC-PERP"
  const parts = market.split("-");
  if (parts.length >= 1) {
    return parts[0];
  }

  return market;
}

// Determine if a trade is opening or closing a position
// This is a heuristic - in reality, we'd need position data to be certain
function determineTradeTag(
  trade: ExtendedTrade,
  tradeIndex: number,
  allTrades: ExtendedTrade[]
): PerpsTag {
  // If there's realized PnL, it's closing (at least partially)
  const realizedPnl = parseFloat(trade.realized_pnl);
  if (realizedPnl !== 0) {
    return "close_position";
  }

  // If it's a liquidation, it's always a close
  if (trade.is_liquidation) {
    return "close_position";
  }

  // Otherwise, assume it's an open
  // A more sophisticated approach would track running position per market
  return "open_position";
}

// Normalize Extended trade to Perps transaction
export function normalizeExtendedTrade(
  trade: ExtendedTrade,
  tradeIndex: number,
  allTrades: ExtendedTrade[]
): PerpsTransaction {
  const tag = determineTradeTag(trade, tradeIndex, allTrades);
  const realizedPnl = parseFloat(trade.realized_pnl) || 0;
  const fee = parseFloat(trade.fee) || 0;
  const size = parseFloat(trade.size) || 0;

  // Build notes based on trade details
  const notes = [
    `${trade.side.toUpperCase()} ${trade.market}`,
    `@ ${trade.price}`,
    trade.trade_type === "maker" ? "Maker" : "Taker",
    trade.is_liquidation ? "LIQUIDATION" : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    id: trade.id,
    date: new Date(trade.timestamp),
    asset: parseMarketAsset(trade.market),
    amount: size,
    fee: fee,
    pnl: realizedPnl,
    paymentToken: trade.fee_asset || "USDC",
    notes: notes,
    transactionHash: trade.order_id || trade.id,
    tag: tag,
  };
}

// Normalize Extended funding payment to Perps transaction
export function normalizeExtendedFundingPayment(
  payment: ExtendedFundingPayment
): PerpsTransaction {
  const paymentAmount = parseFloat(payment.payment) || 0;
  const positionSize = parseFloat(payment.position_size) || 0;
  const fundingRate = parseFloat(payment.funding_rate) || 0;

  // Notes include funding rate info
  const ratePercentage = (fundingRate * 100).toFixed(4);
  const notes = [
    `Funding ${payment.market}`,
    `Rate: ${paymentAmount >= 0 ? "+" : ""}${ratePercentage}%`,
    `Position: ${positionSize}`,
  ].join(" | ");

  return {
    id: payment.id,
    date: new Date(payment.timestamp),
    asset: payment.payment_asset || "USDC",  // Funding is usually in stablecoin
    amount: Math.abs(paymentAmount),
    fee: 0,
    pnl: paymentAmount,  // Positive = received, negative = paid
    paymentToken: payment.payment_asset || "USDC",
    notes: notes,
    transactionHash: payment.id,
    tag: "funding_payment",
  };
}

// Normalize all Extended data to Perps transactions
export function normalizeExtendedData(
  trades: ExtendedTrade[],
  fundingPayments: ExtendedFundingPayment[],
  _assetOperations: ExtendedAssetOperation[]  // For future use (deposits/withdrawals)
): PerpsTransaction[] {
  const allTransactions: PerpsTransaction[] = [];

  // Normalize trades
  const normalizedTrades = trades.map((trade, index) =>
    normalizeExtendedTrade(trade, index, trades)
  );
  allTransactions.push(...normalizedTrades);

  // Normalize funding payments
  const normalizedFunding = fundingPayments.map(normalizeExtendedFundingPayment);
  allTransactions.push(...normalizedFunding);

  // Sort by date descending (newest first)
  allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  return allTransactions;
}

// Calculate summary statistics
export interface ExtendedSummary {
  totalTrades: number;
  openPositions: number;
  closePositions: number;
  fundingPayments: number;
  totalPnL: number;
  totalFees: number;
  tradedAssets: string[];
}

export function calculateSummary(transactions: PerpsTransaction[]): ExtendedSummary {
  const summary: ExtendedSummary = {
    totalTrades: 0,
    openPositions: 0,
    closePositions: 0,
    fundingPayments: 0,
    totalPnL: 0,
    totalFees: 0,
    tradedAssets: [],
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
