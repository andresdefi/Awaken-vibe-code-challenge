import type { NormalizedTransaction, PerpsTransaction } from "./types";

export interface DateRangeParams {
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string;
}

export const DATE_PRESETS = {
  "2025": { startDate: "2025-01-01", endDate: "2025-12-31" },
  "2024": { startDate: "2024-01-01", endDate: "2024-12-31" },
  all: {},
} as const;

export function filterByDateRange<T extends NormalizedTransaction | PerpsTransaction>(
  transactions: T[],
  params: DateRangeParams
): T[] {
  const { startDate, endDate } = params;

  if (!startDate && !endDate) return transactions;

  const start = startDate ? new Date(`${startDate}T00:00:00Z`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;

  return transactions.filter((tx) => {
    const txDate = "timestamp" in tx && tx.timestamp
      ? new Date(tx.timestamp)
      : "date" in tx && tx.date
        ? new Date(tx.date)
        : null;

    if (!txDate) return true;

    if (start && txDate < start) return false;
    if (end && txDate > end) return false;

    return true;
  });
}
