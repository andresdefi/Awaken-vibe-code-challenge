"use client";

import { useState, useCallback } from "react";
import { WalletInput } from "@/components/wallet-input";
import { TransactionTable } from "@/components/transaction-table";
import { DownloadButton } from "@/components/download-button";
import { ProgressIndicator } from "@/components/progress-indicator";
import { TableSkeleton } from "@/components/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { isValidRoninAddress } from "@/lib/chains/ronin/utils";
import type { NormalizedTransaction } from "@/lib/types";

// Example Ronin address (Sky Mavis)
const EXAMPLE_ADDRESS = "0x1f57d5b893e42f0ee64aa42e7cf7c8a7c7e6c8f3";

interface FetchState {
  status: "idle" | "fetching" | "processing" | "complete" | "error";
  message?: string;
}

interface TransactionData {
  address: string;
  transactions: NormalizedTransaction[];
  breakdown: {
    transfers: number;
    swaps: number;
    nfts: number;
    staking: number;
    tokens: number;
  };
}

export default function RoninPage() {
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [data, setData] = useState<TransactionData | null>(null);

  const handleFetchTransactions = useCallback(async (address: string) => {
    setFetchState({ status: "fetching", message: "Connecting to Moralis API..." });
    setData(null);

    try {
      const response = await fetch(`/api/ronin/transactions?address=${encodeURIComponent(address)}`);

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
        address: result.address,
        transactions,
        breakdown: result.breakdown,
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
  }, []);

  const isLoading = fetchState.status === "fetching" || fetchState.status === "processing";

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#1273EA] shadow-lg shadow-[#1273EA]/20">
              <RoninIcon />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Ronin Tax CSV</h1>
              <p className="text-xs text-zinc-500">Export to Awaken.tax format</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://roninchain.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs text-zinc-500 hover:text-zinc-400 dark:hover:text-zinc-300 sm:block"
            >
              Powered by Moralis
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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#1273EA]/10 px-3 py-1 text-xs font-medium text-[#1273EA]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#1273EA] opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-[#1273EA]" />
              </span>
              Complete gaming & DeFi tracking
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
              Export Ronin Transactions
              <br />
              <span className="text-[#1273EA]">for Tax Reporting</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-zinc-600 dark:text-zinc-400">
              Fetch all transfers, swaps, NFT trades, staking rewards, and gaming transactions for any Ronin wallet.
              Download as a CSV compatible with{" "}
              <a
                href="https://awaken.tax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1273EA] hover:underline"
              >
                Awaken.tax
              </a>
              .
            </p>

            {/* Feature badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <FeatureBadge icon={<TransferIcon />} label="Transfers" />
              <FeatureBadge icon={<SwapIcon />} label="Swaps" highlight />
              <FeatureBadge icon={<NftIcon />} label="NFTs" highlight />
              <FeatureBadge icon={<StakeIcon />} label="Staking" />
              <FeatureBadge icon={<GameIcon />} label="Gaming" />
              <FeatureBadge icon={<PriceIcon />} label="USD Prices" />
            </div>
          </div>

          {/* Wallet Input */}
          <div className="flex justify-center">
            <WalletInput
              onSubmit={handleFetchTransactions}
              isLoading={isLoading}
              validateAddress={isValidRoninAddress}
              placeholder="Enter Ronin wallet address (0x... or ronin:...)"
              exampleAddress={EXAMPLE_ADDRESS}
              errorMessage="Invalid address format. Use 0x... or ronin:... format."
              ariaLabel="Ronin wallet address"
            />
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
              {/* Actions Bar */}
              <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/30 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <WalletIcon />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Wallet Address</p>
                    <a
                      href={`https://app.roninchain.com/address/${data.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-[#1273EA] hover:underline"
                    >
                      {data.address.slice(0, 12)}...{data.address.slice(-8)}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-zinc-500">Total Transactions</p>
                    <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{data.transactions.length}</p>
                  </div>
                  <DownloadButton transactions={data.transactions} address={data.address} chain="ronin" />
                </div>
              </div>

              {/* Breakdown Stats */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <StatCard label="Transfers" value={data.breakdown.transfers} color="blue" />
                <StatCard label="Swaps" value={data.breakdown.swaps} color="purple" />
                <StatCard label="NFTs" value={data.breakdown.nfts} color="pink" />
                <StatCard label="Staking" value={data.breakdown.staking} color="green" />
                <StatCard label="Tokens" value={data.breakdown.tokens} color="orange" />
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
                This wallet has no transaction history on the Ronin network.
              </p>
            </div>
          )}

          {/* Error State */}
          {fetchState.status === "error" && (
            <div className="mt-10 rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <p className="text-red-400">{fetchState.message}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Please check the wallet address and try again.
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
                className="text-[#1273EA] hover:underline"
              >
                Awaken.tax
              </a>{" "}
              vibe coding challenge
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://moralis.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Moralis API
              </a>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <a
                href="https://roninchain.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Ronin Chain
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
    pink: "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400",
    green: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${colorClasses[color] || ""}`}>
        {value}
      </p>
    </div>
  );
}

// Feature Badge Component
function FeatureBadge({ icon, label, highlight }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
      highlight
        ? "bg-[#1273EA]/10 text-[#1273EA]"
        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
    }`}>
      {icon}
      {label}
    </div>
  );
}

// Icons
function RoninIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
      <path
        d="M12 2L4 6v12l8 4 8-4V6l-8-4z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M12 6l4 2v8l-4 2-4-2V8l4-2z"
        fill="currentColor"
      />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M21 3l-7 7" />
      <path d="M3 3l7 7" />
      <path d="M16 21h5v-5" />
      <path d="M8 21H3v-5" />
      <path d="M21 21l-7-7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

function NftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function StakeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function GameIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" x2="10" y1="11" y2="11" />
      <line x1="8" x2="8" y1="9" y2="13" />
      <line x1="15" x2="15.01" y1="12" y2="12" />
      <line x1="18" x2="18.01" y1="10" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 18V6" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 dark:text-zinc-400">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
      <path d="M3 3h18v18H3zM21 9H3M9 21V9" />
    </svg>
  );
}
