// GMX V2 transaction normalizer for Awaken Perps CSV format

import type { PerpsTransaction, PerpsTag } from "@/lib/types";
import type { GmxTradeAction, GmxClaimAction } from "./types";
import {
  GMX_MARKET_SYMBOLS,
  INCREASE_EVENTS,
  DECREASE_EVENTS,
  COLLATERAL_TOKENS,
} from "./types";

// USD denominator for GMX (30 decimals)
const USD_DECIMALS = 1e30;

// Token decimals for collateral amounts
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 1e6,
  "USDC.e": 1e6,
  USDT: 1e6,
  WETH: 1e18,
  WBTC: 1e8,
};

// Truncate to reasonable precision
function truncateDecimals(value: number, decimals: number = 6): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Get market symbol from address
function getMarketSymbol(marketAddress: string): string {
  const lower = marketAddress.toLowerCase();
  return GMX_MARKET_SYMBOLS[lower] || marketAddress.slice(0, 10);
}

// Get collateral token symbol
function getCollateralSymbol(tokenAddress: string): string {
  const lower = tokenAddress.toLowerCase();
  return COLLATERAL_TOKENS[lower] || "USD";
}

// Determine if event is position increase
function isIncreaseEvent(eventName: string): boolean {
  return INCREASE_EVENTS.some((e) => eventName.includes(e));
}

// Determine if event is position decrease
function isDecreaseEvent(eventName: string): boolean {
  return DECREASE_EVENTS.some((e) => eventName.includes(e));
}

// Determine the tag for a trade action
function determineTradeTag(action: GmxTradeAction): PerpsTag {
  const eventName = action.eventName;

  // Check for liquidation
  if (eventName.includes("Liquidated") || eventName.includes("Liquidation")) {
    return "close_position";
  }

  // Check for increase/decrease
  if (isIncreaseEvent(eventName)) {
    return "open_position";
  }

  if (isDecreaseEvent(eventName)) {
    return "close_position";
  }

  // Check P&L as fallback - if there's realized P&L, it's likely a close
  const basePnl = parseFloat(action.basePnlUsd || "0") / USD_DECIMALS;
  if (Math.abs(basePnl) > 0.01) {
    return "close_position";
  }

  // Default to open
  return "open_position";
}

// Normalize GMX trade action to Perps transaction
export function normalizeTradeAction(action: GmxTradeAction): PerpsTransaction {
  const tag = determineTradeTag(action);

  // Parse values (GMX uses 30 decimals for USD values)
  const sizeDeltaUsd = truncateDecimals(
    Math.abs(parseFloat(action.sizeDeltaUsd || "0")) / USD_DECIMALS
  );
  const basePnlUsd = truncateDecimals(
    parseFloat(action.basePnlUsd || "0") / USD_DECIMALS
  );
  const priceImpactUsd = truncateDecimals(
    parseFloat(action.priceImpactUsd || "0") / USD_DECIMALS
  );

  // Calculate total P&L including price impact
  const totalPnl = truncateDecimals(basePnlUsd + priceImpactUsd);

  // Calculate total fees
  const borrowingFee = parseFloat(action.borrowingFeeAmount || "0") / USD_DECIMALS;
  const fundingFee = parseFloat(action.fundingFeeAmount || "0") / USD_DECIMALS;
  const positionFee = parseFloat(action.positionFeeAmount || "0") / USD_DECIMALS;
  const totalFees = truncateDecimals(Math.abs(borrowingFee) + Math.abs(fundingFee) + Math.abs(positionFee));

  const marketSymbol = getMarketSymbol(action.marketAddress);
  const collateralSymbol = getCollateralSymbol(action.collateralTokenAddress);

  // Determine if it's a liquidation
  const isLiquidation = action.eventName.includes("Liquidated") || action.eventName.includes("Liquidation");

  // Build notes
  const notes = [
    action.eventName,
    `${marketSymbol}-USD`,
    `Size: $${sizeDeltaUsd.toFixed(2)}`,
    totalPnl !== 0 ? `P&L: ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}` : "",
    isLiquidation ? "LIQUIDATION" : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    id: action.id,
    date: new Date(action.transaction.timestamp * 1000),
    asset: marketSymbol,
    amount: sizeDeltaUsd,
    fee: totalFees,
    pnl: tag === "close_position" ? totalPnl : 0,
    paymentToken: collateralSymbol === "WETH" || collateralSymbol === "WBTC" ? collateralSymbol : "USDC",
    notes,
    transactionHash: action.transaction.hash,
    tag,
    isAmbiguous: isLiquidation,
    ambiguousReasons: isLiquidation ? ["Position was liquidated"] : undefined,
  };
}

// Normalize GMX claim action (funding fee claim) to Perps transaction
export function normalizeClaimAction(action: GmxClaimAction): PerpsTransaction[] {
  const transactions: PerpsTransaction[] = [];

  // Each claim can have multiple markets/amounts
  const marketAddresses = action.marketAddresses || [];
  const amounts = action.amounts || [];

  for (let i = 0; i < marketAddresses.length; i++) {
    const marketAddress = marketAddresses[i];
    const amount = amounts[i] || "0";

    // Claims are typically in USDC (6 decimals)
    const claimAmount = truncateDecimals(parseFloat(amount) / 1e6);

    if (Math.abs(claimAmount) < 0.01) continue; // Skip negligible claims

    const marketSymbol = getMarketSymbol(marketAddress);

    transactions.push({
      id: `${action.id}-${i}`,
      date: new Date(action.transaction.timestamp * 1000),
      asset: marketSymbol,
      amount: 0,
      fee: 0,
      pnl: claimAmount, // Positive = received funding
      paymentToken: "USDC",
      notes: `Funding claim ${marketSymbol}-USD | Amount: ${claimAmount >= 0 ? "+" : ""}$${claimAmount.toFixed(2)}`,
      transactionHash: action.transaction.hash,
      tag: "funding_payment",
    });
  }

  return transactions;
}

// Normalize all GMX data to Perps transactions
export function normalizeGmxData(
  tradeActions: GmxTradeAction[],
  claimActions: GmxClaimAction[]
): PerpsTransaction[] {
  const allTransactions: PerpsTransaction[] = [];

  // Normalize trade actions
  for (const action of tradeActions) {
    allTransactions.push(normalizeTradeAction(action));
  }

  // Normalize claim actions
  for (const claim of claimActions) {
    allTransactions.push(...normalizeClaimAction(claim));
  }

  // Sort by date descending (newest first)
  allTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  return allTransactions;
}

// Summary statistics
export interface GmxSummary {
  totalTrades: number;
  openPositions: number;
  closePositions: number;
  fundingPayments: number;
  totalPnL: number;
  totalFees: number;
  tradedAssets: string[];
}

export function calculateSummary(transactions: PerpsTransaction[]): GmxSummary {
  const summary: GmxSummary = {
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
  summary.totalPnL = truncateDecimals(summary.totalPnL);
  summary.totalFees = truncateDecimals(summary.totalFees);

  return summary;
}
