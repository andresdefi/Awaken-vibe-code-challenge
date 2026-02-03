"use client";

import { useState, useCallback, FormEvent } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProgressIndicator } from "@/components/progress-indicator";
import type { PerpsTransaction } from "@/lib/types";
import { generateAwakenPerpsCSV } from "@/lib/csv";
import Link from "next/link";

interface FetchState {
  status: "idle" | "fetching" | "processing" | "complete" | "error";
  message?: string;
}

interface TransactionSummary {
  totalTrades: number;
  openPositions: number;
  closePositions: number;
  fundingPayments: number;
  totalPnL: number;
  totalFees: number;
  tradedAssets: string[];
  subaccounts: number;
}

interface TransactionData {
  transactions: PerpsTransaction[];
  summary: TransactionSummary;
}

export default function DydxPage() {
  const [address, setAddress] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [data, setData] = useState<TransactionData | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!address.trim()) {
        setFetchState({
          status: "error",
          message: "Please enter your dYdX wallet address",
        });
        return;
      }

      // Basic validation
      if (!address.startsWith("dydx1")) {
        setFetchState({
          status: "error",
          message: "dYdX addresses must start with 'dydx1'",
        });
        return;
      }

      setFetchState({ status: "fetching", message: "Connecting to dYdX indexer..." });
      setData(null);

      try {
        const response = await fetch("/api/dydx/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: address.trim() }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch transactions");
        }

        setFetchState({ status: "processing", message: "Processing trades..." });

        const result = await response.json();

        const transactions: PerpsTransaction[] = result.transactions.map(
          (tx: PerpsTransaction & { date: string }) => ({
            ...tx,
            date: new Date(tx.date),
          })
        );

        setData({
          transactions,
          summary: result.summary,
        });

        setFetchState({
          status: "complete",
          message: `Found ${transactions.length} transactions`,
        });
      } catch (error) {
        setFetchState({
          status: "error",
          message: error instanceof Error ? error.message : "An unexpected error occurred",
        });
      }
    },
    [address]
  );

  const handleDownloadCSV = useCallback(() => {
    if (!data || data.transactions.length === 0) return;

    const csv = generateAwakenPerpsCSV(data.transactions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "dydx-perps-awaken.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data]);

  const isLoading = fetchState.status === "fetching" || fetchState.status === "processing";

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 shadow-lg shadow-orange-500/20">
                <DydxIcon />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">dYdX Perps CSV</h1>
                <p className="text-xs text-zinc-500">Export to Awaken.tax format</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://dydx.exchange"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs text-zinc-500 hover:text-zinc-400 dark:hover:text-zinc-300 sm:block"
            >
              dYdX Exchange
            </a>
            <a
              href="https://github.com/andresdefi/Awaken-vibe-code-challenge"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              GitHub
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          {/* Hero Section */}
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-600 dark:text-orange-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-orange-500" />
              </span>
              Perpetuals Trading History
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
              Export dYdX v4 Perps
              <br />
              <span className="bg-gradient-to-r from-orange-600 to-rose-600 bg-clip-text text-transparent">for Tax Reporting</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-zinc-600 dark:text-zinc-400">
              Fetch all trades, positions, and funding payments from dYdX v4.
              Download as a CSV compatible with{" "}
              <a
                href="https://awaken.tax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-600 hover:underline dark:text-orange-400"
              >
                Awaken.tax
              </a>
              &apos;s Perps format.
            </p>

            {/* Feature badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <FeatureBadge icon={<TradeIcon />} label="Trades" highlight />
              <FeatureBadge icon={<PositionIcon />} label="Positions" highlight />
              <FeatureBadge icon={<FundingIcon />} label="Funding" />
              <FeatureBadge icon={<PnLIcon />} label="P&L" />
              <FeatureBadge icon={<KeyIcon />} label="No API Key" />
            </div>
          </div>

          {/* Address Input */}
          <div className="mx-auto max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="mb-4">
                  <label htmlFor="address" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    dYdX Wallet Address
                  </label>
                  <p className="mt-1 text-xs text-zinc-500">
                    Enter your dYdX v4 wallet address (starts with dydx1).
                    No API key required - uses the public indexer.
                  </p>
                </div>
                <div className="relative">
                  <input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="dydx1..."
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    disabled={isLoading}
                    aria-label="dYdX wallet address"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    Your address is only used to query the public dYdX indexer.
                  </p>
                  <button
                    type="submit"
                    disabled={isLoading || !address.trim()}
                    className="rounded-lg bg-gradient-to-r from-orange-600 to-rose-600 px-6 py-2.5 text-sm font-medium text-white transition-all hover:from-orange-500 hover:to-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? "Fetching..." : "Fetch Transactions"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Progress Indicator */}
          {fetchState.status !== "idle" && fetchState.status !== "complete" && (
            <div className="mx-auto mt-6 max-w-2xl">
              <ProgressIndicator status={fetchState.status} message={fetchState.message} />
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="mt-10">
              <PerpsTableSkeleton />
            </div>
          )}

          {/* Results */}
          {data && data.transactions.length > 0 && !isLoading && (
            <div className="mt-10 space-y-6">
              {/* Summary Bar */}
              <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/30 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-500/10">
                    <ChartIcon />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Total P&L (Funding)</p>
                    <p className={`font-semibold tabular-nums ${
                      data.summary.totalPnL >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {data.summary.totalPnL >= 0 ? "+" : ""}
                      {data.summary.totalPnL.toFixed(2)} USDC
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-zinc-500">Total Transactions</p>
                    <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {data.transactions.length}
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-600 to-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-orange-500 hover:to-rose-500"
                  >
                    <DownloadIcon />
                    Download Perps CSV
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <StatCard
                  label="Open Positions"
                  value={data.summary.openPositions}
                  color="orange"
                />
                <StatCard
                  label="Close Positions"
                  value={data.summary.closePositions}
                  color="rose"
                />
                <StatCard
                  label="Funding Payments"
                  value={data.summary.fundingPayments}
                  color="blue"
                />
                <StatCard
                  label="Total Fees"
                  value={`$${data.summary.totalFees.toFixed(2)}`}
                  color="zinc"
                  isString
                />
                <StatCard
                  label="Subaccounts"
                  value={data.summary.subaccounts}
                  color="amber"
                />
              </div>

              {/* Traded Assets */}
              {data.summary.tradedAssets.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                  <span className="text-xs text-zinc-500">Traded Assets:</span>
                  {data.summary.tradedAssets.map((asset) => (
                    <span
                      key={asset}
                      className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                    >
                      {asset}
                    </span>
                  ))}
                </div>
              )}

              {/* Transaction Table */}
              <PerpsTransactionTable transactions={data.transactions} />
            </div>
          )}

          {/* Empty State */}
          {data && data.transactions.length === 0 && fetchState.status === "complete" && (
            <div className="mt-10 rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <EmptyIcon />
              </div>
              <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No transactions found</p>
              <p className="mt-2 text-sm text-zinc-500">
                This address has no trading history on dYdX v4.
              </p>
            </div>
          )}

          {/* Error State */}
          {fetchState.status === "error" && (
            <div className="mt-10 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <p className="text-red-400">{fetchState.message}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Please check your address and try again.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-zinc-100/50 dark:border-zinc-800/50 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-zinc-500 sm:flex-row">
            <p>
              Built for the{" "}
              <a
                href="https://awaken.tax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-600 hover:underline dark:text-orange-400"
              >
                Awaken.tax
              </a>{" "}
              vibe coding challenge
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://docs.dydx.exchange/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                dYdX Docs
              </a>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <a
                href="https://www.mintscan.io/dydx"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Explorer
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Perps Transaction Table Component
function PerpsTransactionTable({ transactions }: { transactions: PerpsTransaction[] }) {
  const formatDate = (date: Date) => {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPnL = (pnl: number) => {
    if (pnl === 0) return "0";
    const formatted = Math.abs(pnl).toFixed(2);
    return pnl > 0 ? `+${formatted}` : `-${formatted}`;
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case "open_position":
        return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
      case "close_position":
        return "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400";
      case "funding_payment":
        return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
      default:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Asset</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">P&L</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Fee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Tag</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {transactions.slice(0, 100).map((tx) => (
              <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {formatDate(tx.date)}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{tx.asset}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
                  {tx.amount.toFixed(4)}
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums ${
                  tx.pnl > 0
                    ? "text-green-600 dark:text-green-400"
                    : tx.pnl < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-500"
                }`}>
                  {formatPnL(tx.pnl)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums text-zinc-500">
                  {tx.fee > 0 ? tx.fee.toFixed(4) : "-"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getTagColor(tx.tag)}`}>
                    {tx.tag.replace("_", " ")}
                  </span>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-sm text-zinc-500" title={tx.notes}>
                  {tx.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {transactions.length > 100 && (
        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
          Showing 100 of {transactions.length} transactions. Download CSV for complete data.
        </div>
      )}
    </div>
  );
}

// Loading Skeleton
function PerpsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

// Stat Card
function StatCard({
  label,
  value,
  color,
  isString,
}: {
  label: string;
  value: number | string;
  color: string;
  isString?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    orange: "text-orange-700 dark:text-orange-400",
    rose: "text-rose-700 dark:text-rose-400",
    blue: "text-blue-700 dark:text-blue-400",
    zinc: "text-zinc-700 dark:text-zinc-400",
    amber: "text-amber-700 dark:text-amber-400",
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${colorClasses[color] || ""}`}>
        {isString ? value : value.toLocaleString()}
      </p>
    </div>
  );
}

// Feature Badge
function FeatureBadge({ icon, label, highlight }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
      highlight
        ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
    }`}>
      {icon}
      {label}
    </div>
  );
}

// Icons
function DydxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

function TradeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function PositionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function FundingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function PnLIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600 dark:text-orange-400">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
      <path d="M3 3h18v18H3zM21 9H3M9 21V9" />
    </svg>
  );
}
