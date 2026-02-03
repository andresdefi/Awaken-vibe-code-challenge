"use client";

import { useState, useCallback } from "react";
import { WalletInput } from "@/components/wallet-input";
import { TransactionTable } from "@/components/transaction-table";
import { DownloadButton } from "@/components/download-button";
import { ProgressIndicator } from "@/components/progress-indicator";
import { TableSkeleton } from "@/components/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { isValidKusamaAddress } from "@/lib/chains/kusama/utils";
import type { NormalizedTransaction } from "@/lib/types";

// Example Kusama address (active staker with history)
const EXAMPLE_ADDRESS = "CpjsLDC1JFyrhm3ftC9Gs4QoyrkHKhZKtK7YqGTRFtTafgp";

interface FetchState {
  status: "idle" | "fetching" | "processing" | "complete" | "error";
  message?: string;
}

interface TransactionData {
  address: string;
  transactions: NormalizedTransaction[];
  breakdown: {
    transfers: number;
    rewards: number;
    slashes: number;
    staking: number;
    crowdloans: number;
    auctions: number;
  };
}

export default function KusamaPage() {
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [data, setData] = useState<TransactionData | null>(null);

  const handleFetchTransactions = useCallback(async (address: string) => {
    setFetchState({ status: "fetching", message: "Connecting to Subscan API..." });
    setData(null);

    try {
      const response = await fetch(`/api/kusama/transactions?address=${encodeURIComponent(address)}`);

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
            <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-900 shadow-lg shadow-zinc-900/20 dark:bg-zinc-100">
              <KusamaIcon />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Kusama Tax CSV</h1>
              <p className="text-xs text-zinc-500">Export to Awaken.tax format</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://kusama.subscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs text-zinc-500 hover:text-zinc-400 dark:hover:text-zinc-300 sm:block"
            >
              Powered by Subscan
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
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-zinc-900/10 px-3 py-1 text-xs font-medium text-zinc-900 dark:bg-zinc-100/10 dark:text-zinc-100">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-zinc-900 opacity-75 dark:bg-zinc-100" />
                <span className="relative inline-flex size-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
              </span>
              Polkadot&apos;s Canary Network
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
              Export Kusama Transactions
              <br />
              <span className="text-zinc-600 dark:text-zinc-400">for Tax Reporting</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-zinc-600 dark:text-zinc-400">
              Fetch all transfers, staking rewards, slashing events, crowdloan contributions, and auction bids for any Kusama wallet.
              Download as a CSV compatible with{" "}
              <a
                href="https://awaken.tax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 hover:underline dark:text-zinc-100"
              >
                Awaken.tax
              </a>
              .
            </p>

            {/* Feature badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <FeatureBadge icon={<TransferIcon />} label="Transfers" />
              <FeatureBadge icon={<StakeIcon />} label="Staking" />
              <FeatureBadge icon={<RewardIcon />} label="Rewards" />
              <FeatureBadge icon={<SlashIcon />} label="Slashing" />
              <FeatureBadge icon={<CrowdloanIcon />} label="Crowdloans" highlight />
              <FeatureBadge icon={<AuctionIcon />} label="Auctions" highlight />
              <FeatureBadge icon={<PriceIcon />} label="USD Prices" />
            </div>
          </div>

          {/* Wallet Input */}
          <div className="flex justify-center">
            <WalletInput
              onSubmit={handleFetchTransactions}
              isLoading={isLoading}
              validateAddress={isValidKusamaAddress}
              placeholder="Enter Kusama wallet address (C, D, E, F, G, H, J...)"
              exampleAddress={EXAMPLE_ADDRESS}
              errorMessage="Invalid address format. Kusama addresses start with C, D, E, F, G, H, or J and are 47-48 characters."
              ariaLabel="Kusama wallet address"
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
                      href={`https://kusama.subscan.io/account/${data.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-zinc-900 hover:underline dark:text-zinc-100"
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
                  <DownloadButton transactions={data.transactions} address={data.address} chain="kusama" />
                </div>
              </div>

              {/* Breakdown Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Transfers" value={data.breakdown.transfers} />
                <StatCard label="Rewards" value={data.breakdown.rewards} />
                <StatCard label="Slashes" value={data.breakdown.slashes} />
                <StatCard label="Staking" value={data.breakdown.staking} />
                <StatCard label="Crowdloans" value={data.breakdown.crowdloans} highlight />
                <StatCard label="Auctions" value={data.breakdown.auctions} highlight />
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
                This wallet has no transaction history on the Kusama network.
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

          {/* Info Box */}
          <div className="mt-12 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">About Kusama</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Kusama is Polkadot&apos;s canary network - a wild, fast-moving experimental platform where new features are tested before deploying to Polkadot.
              Key differences from Polkadot include:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-zinc-400" />
                <strong>7-day unbonding</strong> period (vs 28 days on Polkadot)
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-zinc-400" />
                <strong>Faster governance</strong> cycles for rapid iteration
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-zinc-400" />
                <strong>Lower barriers</strong> for validators and parachains
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-zinc-400" />
                <strong>Crowdloan</strong> support for parachain slot auctions
              </li>
            </ul>
          </div>
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
                className="text-zinc-900 hover:underline dark:text-zinc-100"
              >
                Awaken.tax
              </a>{" "}
              vibe coding challenge
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://kusama.subscan.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Subscan API
              </a>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <a
                href="https://kusama.network"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Kusama
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${
      highlight
        ? "border-amber-500/20 bg-amber-500/5 dark:border-amber-400/20 dark:bg-amber-400/5"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30"
    }`}>
      <p className={`text-xs ${highlight ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}>{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${
        highlight ? "text-amber-700 dark:text-amber-300" : "text-zinc-900 dark:text-zinc-100"
      }`}>{value}</p>
    </div>
  );
}

// Feature Badge Component
function FeatureBadge({ icon, label, highlight }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
      highlight
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
    }`}>
      {icon}
      {label}
    </div>
  );
}

// Icons
function KusamaIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white dark:text-zinc-900">
      <path
        d="M12 2L4 6v12l8 4 8-4V6l-8-4zm0 2.5L18 8v8l-6 3-6-3V8l6-3.5z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
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

function StakeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function RewardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function SlashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 2 22" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function CrowdloanIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AuctionIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14.5 12.5-5 5a2.121 2.121 0 1 1-3-3l5-5" />
      <path d="M16 10V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12" />
      <path d="m21.64 15.36-3.5-3.5a1 1 0 0 0-1.41 0l-1.83 1.83 4.91 4.91 1.83-1.83a1 1 0 0 0 0-1.41z" />
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
