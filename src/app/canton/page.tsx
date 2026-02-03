"use client";

import { useState, useCallback } from "react";
import { TransactionTable } from "@/components/transaction-table";
import { DownloadButton } from "@/components/download-button";
import { ProgressIndicator } from "@/components/progress-indicator";
import { TableSkeleton } from "@/components/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { isValidPartyId } from "@/lib/chains/canton/api";
import type { NormalizedTransaction } from "@/lib/types";
import Link from "next/link";

// Example Canton Party ID
const EXAMPLE_PARTY_ID = "Digital-Asset-2::12209b21d512c6a7e2f5d215266fe6568cb732caaef7ff04e308f990a652340d3529";

interface FetchState {
  status: "idle" | "fetching" | "processing" | "complete" | "error";
  message?: string;
}

interface TransactionData {
  partyId: string;
  transactions: NormalizedTransaction[];
  balance: {
    unlockedBalance: string;
    lockedBalance: string;
    holdingFees: string;
  } | null;
  summary: {
    transfers: number;
    rewards: number;
    totalSent: number;
    totalReceived: number;
    totalFees: number;
  };
}

export default function CantonPage() {
  const [partyId, setPartyId] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [data, setData] = useState<TransactionData | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedPartyId = partyId.trim();

      if (!trimmedPartyId) {
        setFetchState({
          status: "error",
          message: "Please enter a Canton Party ID",
        });
        return;
      }

      if (!isValidPartyId(trimmedPartyId)) {
        setFetchState({
          status: "error",
          message: "Invalid Party ID format. Use format: hint::hash (e.g., MyWallet::1220abc...)",
        });
        return;
      }

      setFetchState({ status: "fetching", message: "Connecting to Canton Network..." });
      setData(null);

      try {
        const response = await fetch(
          `/api/canton/transactions?partyId=${encodeURIComponent(trimmedPartyId)}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch transactions");
        }

        setFetchState({ status: "processing", message: "Processing transactions..." });

        const result = await response.json();

        const transactions: NormalizedTransaction[] = result.transactions.map(
          (tx: NormalizedTransaction & { timestamp: string }) => ({
            ...tx,
            timestamp: new Date(tx.timestamp),
          })
        );

        setData({
          partyId: result.partyId,
          transactions,
          balance: result.balance,
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
    [partyId]
  );

  const useExample = () => {
    setPartyId(EXAMPLE_PARTY_ID);
  };

  const isLoading = fetchState.status === "fetching" || fetchState.status === "processing";

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
                <CantonIcon />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Canton Tax CSV</h1>
                <p className="text-xs text-zinc-500">Export to Awaken.tax format</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://canton.network"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs text-zinc-500 hover:text-zinc-400 dark:hover:text-zinc-300 sm:block"
            >
              Canton Network
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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-600 dark:text-cyan-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-cyan-500" />
              </span>
              Enterprise blockchain for financial institutions
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
              Export Canton Transactions
              <br />
              <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">for Tax Reporting</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-zinc-600 dark:text-zinc-400">
              Fetch Canton Coin (CC) transfers, rewards, and fees for any Canton Party.
              Download as a CSV compatible with{" "}
              <a
                href="https://awaken.tax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-600 hover:underline dark:text-cyan-400"
              >
                Awaken.tax
              </a>
              .
            </p>

            {/* Feature badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <FeatureBadge icon={<TransferIcon />} label="Transfers" highlight />
              <FeatureBadge icon={<RewardIcon />} label="Rewards" highlight />
              <FeatureBadge icon={<FeeIcon />} label="Fees" />
              <FeatureBadge icon={<LockIcon />} label="Locked CC" />
            </div>
          </div>

          {/* Party ID Input */}
          <div className="mx-auto max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="mb-4">
                  <label htmlFor="partyId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Canton Party ID
                  </label>
                  <p className="mt-1 text-xs text-zinc-500">
                    Your Canton wallet address in format: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">hint::hash</code>
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    id="partyId"
                    type="text"
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    placeholder="MyWallet::1220abc123..."
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    disabled={isLoading}
                    aria-label="Canton Party ID"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !partyId.trim()}
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 text-sm font-medium text-white transition-all hover:from-cyan-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? "Fetching..." : "Fetch"}
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={useExample}
                    className="text-xs text-cyan-600 hover:underline dark:text-cyan-400"
                    disabled={isLoading}
                  >
                    Use example Party ID
                  </button>
                  <p className="text-xs text-zinc-500">
                    Powered by{" "}
                    <a
                      href="https://cantonnodes.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-600 hover:underline dark:text-cyan-400"
                    >
                      Canton Nodes
                    </a>
                  </p>
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
              <TableSkeleton />
            </div>
          )}

          {/* Results */}
          {data && data.transactions.length > 0 && !isLoading && (
            <div className="mt-10 space-y-6">
              {/* Summary Bar */}
              <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/30 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-500/10">
                    <WalletIcon />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Party ID</p>
                    <p className="font-mono text-sm text-cyan-600 dark:text-cyan-400">
                      {data.partyId.split("::")[0]}::
                      <span className="text-zinc-500">
                        {data.partyId.split("::")[1]?.slice(0, 12)}...
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {data.balance && (
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-zinc-500">Balance</p>
                      <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {parseFloat(data.balance.unlockedBalance).toFixed(2)} CC
                      </p>
                    </div>
                  )}
                  <DownloadButton transactions={data.transactions} address={data.partyId} chain="canton" />
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Transfers" value={data.summary.transfers} color="cyan" />
                <StatCard label="Rewards" value={data.summary.rewards} color="blue" />
                <StatCard
                  label="Total Received"
                  value={`${data.summary.totalReceived.toFixed(2)} CC`}
                  color="green"
                  isString
                />
                <StatCard
                  label="Total Sent"
                  value={`${data.summary.totalSent.toFixed(2)} CC`}
                  color="orange"
                  isString
                />
              </div>

              {/* Transaction Table */}
              <TransactionTable transactions={data.transactions} />
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
                This party has no transaction history on Canton Network.
              </p>
            </div>
          )}

          {/* Error State */}
          {fetchState.status === "error" && (
            <div className="mt-10 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <p className="text-red-400">{fetchState.message}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Please check the Party ID and try again.
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
                className="text-cyan-600 hover:underline dark:text-cyan-400"
              >
                Awaken.tax
              </a>{" "}
              vibe coding challenge
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://cantonnodes.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Canton Nodes API
              </a>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <a
                href="https://canton.network"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Canton Network
              </a>
            </div>
          </div>
        </div>
      </footer>
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
    cyan: "text-cyan-700 dark:text-cyan-400",
    blue: "text-blue-700 dark:text-blue-400",
    green: "text-green-700 dark:text-green-400",
    orange: "text-orange-700 dark:text-orange-400",
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
        ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
    }`}>
      {icon}
      {label}
    </div>
  );
}

// Icons
function CantonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function RewardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function FeeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-600 dark:text-cyan-400">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
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
