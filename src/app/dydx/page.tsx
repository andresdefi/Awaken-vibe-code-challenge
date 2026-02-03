"use client";

import { useState, useCallback, FormEvent } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ChainLogo } from "@/components/chain-logo";
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
    <div className="flex min-h-dvh flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <ChainLogo chainId="dydx" size={40} />
              <div>
                <h1 className="text-lg font-semibold text-[var(--foreground)]">dYdX</h1>
                <p className="text-xs text-[var(--muted)]">Export to Awaken.tax</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://dydx.exchange"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)] sm:block"
            >
              dYdX Exchange
            </a>
            <a
              href="https://github.com/andresdefi/Awaken-vibe-code-challenge"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-colors hover:opacity-90"
            >
              GitHub
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          {/* Hero Section */}
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent-muted)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--accent)]" />
              </span>
              Perpetuals Trading History
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
              Export dYdX v4 Perps
              <br />
              <span className="text-[var(--accent)]">for Tax Reporting</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-[var(--muted)]">
              Fetch all trades, positions, and funding payments from dYdX v4.
              Download as a CSV compatible with{" "}
              <a
                href="https://awaken.tax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                Awaken.tax
              </a>
              &apos;s Perps format.
            </p>

            {/* Feature badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <FeatureBadge label="Trades" highlight />
              <FeatureBadge label="Positions" highlight />
              <FeatureBadge label="Funding" />
              <FeatureBadge label="P&L" />
              <FeatureBadge label="No API Key" />
            </div>
          </div>

          {/* Address Input */}
          <div className="mx-auto max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
                <div className="mb-4">
                  <label htmlFor="address" className="block text-sm font-medium text-[var(--foreground)]">
                    dYdX Wallet Address
                  </label>
                  <p className="mt-1 text-xs text-[var(--muted)]">
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
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                    disabled={isLoading}
                    aria-label="dYdX wallet address"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-[var(--muted)]">
                    Your address is only used to query the public indexer.
                  </p>
                  <button
                    type="submit"
                    disabled={isLoading || !address.trim()}
                    className="rounded-lg bg-[var(--foreground)] px-6 py-2.5 text-sm font-medium text-[var(--background)] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? "Fetching..." : "Fetch Transactions"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Progress Indicator */}
          {fetchState.status !== "idle" && fetchState.status !== "complete" && (
            <div className="mx-auto mt-6 max-w-xl">
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
              <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--accent-muted)]">
                    <ChartIcon />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)]">Total P&L (Funding)</p>
                    <p className={`font-semibold tabular-nums ${
                      data.summary.totalPnL >= 0
                        ? "text-[var(--success)]"
                        : "text-red-500"
                    }`}>
                      {data.summary.totalPnL >= 0 ? "+" : ""}
                      {data.summary.totalPnL.toFixed(2)} USDC
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-[var(--muted)]">Total Transactions</p>
                    <p className="font-semibold tabular-nums text-[var(--foreground)]">
                      {data.transactions.length}
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] transition-all hover:opacity-90"
                  >
                    <DownloadIcon />
                    Download Perps CSV
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <StatCard label="Open Positions" value={data.summary.openPositions} />
                <StatCard label="Close Positions" value={data.summary.closePositions} />
                <StatCard label="Funding Payments" value={data.summary.fundingPayments} />
                <StatCard label="Total Fees" value={`$${data.summary.totalFees.toFixed(2)}`} isString />
                <StatCard label="Subaccounts" value={data.summary.subaccounts} />
              </div>

              {/* Traded Assets */}
              {data.summary.tradedAssets.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                  <span className="text-xs text-[var(--muted)]">Traded Assets:</span>
                  {data.summary.tradedAssets.map((asset) => (
                    <span
                      key={asset}
                      className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]"
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
            <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--muted)]/20">
                <EmptyIcon />
              </div>
              <p className="text-lg font-medium text-[var(--foreground)]">No transactions found</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                This address has no trading history on dYdX v4.
              </p>
            </div>
          )}

          {/* Error State */}
          {fetchState.status === "error" && (
            <div className="mt-10 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <p className="text-red-500">{fetchState.message}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Please check your address and try again.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-[var(--muted)] sm:flex-row">
            <p>
              Built for{" "}
              <a
                href="https://awaken.tax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                Awaken.tax
              </a>
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://docs.dydx.exchange/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--foreground)]"
              >
                dYdX Docs
              </a>
              <span className="text-[var(--border)]">|</span>
              <a
                href="https://www.mintscan.io/dydx"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--foreground)]"
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

// Perps Transaction Table
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
        return "bg-[var(--accent-muted)] text-[var(--accent)]";
      case "funding_payment":
        return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
      default:
        return "bg-[var(--muted)]/20 text-[var(--muted)]";
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--background)]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Asset</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">P&L</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted)]">Fee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Tag</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted)]">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {transactions.slice(0, 100).map((tx) => (
              <tr key={tx.id} className="hover:bg-[var(--card-hover)]">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--muted)]">
                  {formatDate(tx.date)}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-[var(--foreground)]">{tx.asset}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums text-[var(--foreground)]">
                  {tx.amount.toFixed(4)}
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums ${
                  tx.pnl > 0
                    ? "text-[var(--success)]"
                    : tx.pnl < 0
                    ? "text-red-500"
                    : "text-[var(--muted)]"
                }`}>
                  {formatPnL(tx.pnl)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm tabular-nums text-[var(--muted)]">
                  {tx.fee > 0 ? tx.fee.toFixed(4) : "-"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getTagColor(tx.tag)}`}>
                    {tx.tag.replace("_", " ")}
                  </span>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-sm text-[var(--muted)]" title={tx.notes}>
                  {tx.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {transactions.length > 100 && (
        <div className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-3 text-center text-sm text-[var(--muted)]">
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
      <div className="h-24 animate-pulse rounded-xl bg-[var(--border)]" />
      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-[var(--border)]" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-[var(--border)]" />
    </div>
  );
}

// Stat Card
function StatCard({ label, value, isString }: { label: string; value: number | string; isString?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
        {isString ? value : value.toLocaleString()}
      </p>
    </div>
  );
}

// Feature Badge
function FeatureBadge({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
      highlight
        ? "bg-[var(--accent-muted)] text-[var(--accent)]"
        : "bg-[var(--border)] text-[var(--muted)]"
    }`}>
      {label}
    </div>
  );
}

// Icons
function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
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
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)]">
      <path d="M3 3h18v18H3zM21 9H3M9 21V9" />
    </svg>
  );
}
