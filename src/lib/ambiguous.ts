import type { NormalizedTransaction, PerpsTransaction } from "./types";

function calculateStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

export function flagAmbiguousTransactions(
  transactions: NormalizedTransaction[]
): NormalizedTransaction[] {
  if (transactions.length === 0) return transactions;

  // Check if any transactions have fiat prices
  const hasFiatPrices = transactions.some((tx) => tx.fiatPrice && tx.fiatPrice > 0);

  // Calculate amount statistics for outlier detection
  const amounts = transactions
    .map((tx) => Math.abs(tx.sentAmount ?? 0) + Math.abs(tx.receivedAmount ?? 0))
    .filter((a) => a > 0);
  const amountStats = amounts.length >= 5 ? calculateStdDev(amounts) : null;

  return transactions.map((tx) => {
    const reasons: string[] = [];

    // 1. Missing fiat price when other txs have prices
    if (hasFiatPrices && (!tx.fiatPrice || tx.fiatPrice === 0)) {
      const hasValue = (tx.sentAmount && tx.sentAmount > 0) || (tx.receivedAmount && tx.receivedAmount > 0);
      if (hasValue) {
        reasons.push("Missing fiat price");
      }
    }

    // 2. Statistical outlier amount (>3 std devs, min 5 txs)
    if (amountStats && amountStats.stdDev > 0) {
      const txAmount = Math.abs(tx.sentAmount ?? 0) + Math.abs(tx.receivedAmount ?? 0);
      if (txAmount > 0 && Math.abs(txAmount - amountStats.mean) > 3 * amountStats.stdDev) {
        reasons.push("Unusual amount (statistical outlier)");
      }
    }

    // 3. Zero amount with fees (approval/failed tx)
    if (
      (tx.sentAmount === null || tx.sentAmount === 0) &&
      (tx.receivedAmount === null || tx.receivedAmount === 0) &&
      tx.feeAmount > 0
    ) {
      reasons.push("Zero value with fees (possible approval or failed tx)");
    }

    // 4. Self-transfer (sent + received same currency in one tx)
    if (
      tx.sentCurrency &&
      tx.receivedCurrency &&
      tx.sentCurrency === tx.receivedCurrency &&
      tx.sentAmount &&
      tx.sentAmount > 0 &&
      tx.receivedAmount &&
      tx.receivedAmount > 0
    ) {
      reasons.push("Self-transfer (same currency sent and received)");
    }

    if (reasons.length > 0) {
      return { ...tx, isAmbiguous: true, ambiguousReasons: reasons };
    }

    return tx;
  });
}

export function flagAmbiguousPerpsTransactions(
  transactions: PerpsTransaction[]
): PerpsTransaction[] {
  if (transactions.length === 0) return transactions;

  // Calculate P&L statistics for outlier detection
  const pnlValues = transactions.map((tx) => tx.pnl).filter((p) => p !== 0);
  const pnlStats = pnlValues.length >= 5 ? calculateStdDev(pnlValues) : null;

  return transactions.map((tx) => {
    const reasons: string[] = [];

    // 1. Zero P&L on close position
    if (tx.tag === "close_position" && tx.pnl === 0) {
      reasons.push("Zero P&L on close position");
    }

    // 2. Large P&L outlier (>3 std devs)
    if (pnlStats && pnlStats.stdDev > 0 && tx.pnl !== 0) {
      if (Math.abs(tx.pnl - pnlStats.mean) > 3 * pnlStats.stdDev) {
        reasons.push("Unusual P&L (statistical outlier)");
      }
    }

    if (reasons.length > 0) {
      return { ...tx, isAmbiguous: true, ambiguousReasons: reasons };
    }

    return tx;
  });
}
