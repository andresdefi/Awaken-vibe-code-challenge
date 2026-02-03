"use client";

import { useState, useCallback, FormEvent } from "react";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProgressIndicator } from "@/components/progress-indicator";
import { ChainLogo, CHAIN_NAMES, CHAIN_SYMBOLS, CHAIN_DESCRIPTIONS } from "@/components/chain-logo";
import type { PerpsTransaction, NormalizedTransaction } from "@/lib/types";
import { generateAwakenPerpsCSV, generateAwakenCSV } from "@/lib/csv";

interface ChainConfig {
  id: string;
  features: string[];
  inputType: "address" | "apiKey";
  inputLabel: string;
  inputPlaceholder: string;
  inputHelp: string;
  warning?: string;
  isPerps: boolean;
}

const CHAINS: ChainConfig[] = [
  {
    id: "bittensor",
    features: ["Transfers", "Staking", "Emission Rewards", "USD Prices"],
    inputType: "address",
    inputLabel: "Bittensor Wallet Address",
    inputPlaceholder: "5...",
    inputHelp: "Enter your Bittensor (TAO) wallet address starting with 5",
    warning: "Bittensor API has strict rate limits. Fetching may take longer for wallets with many transactions.",
    isPerps: false,
  },
  {
    id: "polkadot",
    features: ["Transfers", "Staking", "Rewards", "Slashing", "USD Prices"],
    inputType: "address",
    inputLabel: "Polkadot Wallet Address",
    inputPlaceholder: "1...",
    inputHelp: "Enter your Polkadot (DOT) wallet address",
    isPerps: false,
  },
  {
    id: "kusama",
    features: ["Transfers", "Staking", "Crowdloans", "Auctions", "USD Prices"],
    inputType: "address",
    inputLabel: "Kusama Wallet Address",
    inputPlaceholder: "C... or D... or F...",
    inputHelp: "Enter your Kusama (KSM) wallet address",
    isPerps: false,
  },
  {
    id: "osmosis",
    features: ["Transfers", "Swaps", "LP Positions", "Staking", "IBC", "USD Prices"],
    inputType: "address",
    inputLabel: "Osmosis Wallet Address",
    inputPlaceholder: "osmo1...",
    inputHelp: "Enter your Osmosis wallet address starting with osmo1",
    isPerps: false,
  },
  {
    id: "injective",
    features: ["Transfers", "Staking", "IBC", "Trading", "USD Prices"],
    inputType: "address",
    inputLabel: "Injective Wallet Address",
    inputPlaceholder: "inj1...",
    inputHelp: "Enter your Injective wallet address starting with inj1",
    isPerps: false,
  },
  {
    id: "ronin",
    features: ["Transfers", "Swaps", "NFTs", "Staking", "Gaming", "USD Prices"],
    inputType: "address",
    inputLabel: "Ronin Wallet Address",
    inputPlaceholder: "0x... or ronin:...",
    inputHelp: "Enter your Ronin wallet address",
    isPerps: false,
  },
  {
    id: "extended",
    features: ["Trades", "Positions", "Funding", "P&L"],
    inputType: "apiKey",
    inputLabel: "Extended API Key",
    inputPlaceholder: "Enter your Extended API key",
    inputHelp: "Create an API key in your Extended account settings. No Stark key required.",
    isPerps: true,
  },
  {
    id: "dydx",
    features: ["Trades", "Positions", "Funding", "P&L", "No API Key"],
    inputType: "address",
    inputLabel: "dYdX Wallet Address",
    inputPlaceholder: "dydx1...",
    inputHelp: "Enter your dYdX v4 wallet address starting with dydx1",
    isPerps: true,
  },
  {
    id: "canton",
    features: ["Transfers", "Rewards", "Fees", "Locked CC"],
    inputType: "address",
    inputLabel: "Canton Participant ID",
    inputPlaceholder: "Enter your participant ID",
    inputHelp: "Enter your Canton Network participant ID",
    isPerps: false,
  },
];

interface FetchState {
  status: "idle" | "fetching" | "processing" | "complete" | "error";
  message?: string;
}

interface TransactionSummary {
  totalTrades?: number;
  openPositions?: number;
  closePositions?: number;
  fundingPayments?: number;
  totalPnL?: number;
  totalFees?: number;
  tradedAssets?: string[];
  subaccounts?: number;
  totalTransactions?: number;
}

export default function Home() {
  const [selectedChain, setSelectedChain] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [transactions, setTransactions] = useState<(PerpsTransaction | NormalizedTransaction)[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);

  const selectedChainConfig = CHAINS.find((c) => c.id === selectedChain);

  const handleChainSelect = (chainId: string) => {
    setSelectedChain(chainId);
    setIsDropdownOpen(false);
    setInputValue("");
    setFetchState({ status: "idle" });
    setTransactions([]);
    setSummary(null);
  };

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!inputValue.trim() || !selectedChainConfig) {
        setFetchState({
          status: "error",
          message: `Please enter your ${selectedChainConfig?.inputLabel.toLowerCase() || "input"}`,
        });
        return;
      }

      setFetchState({ status: "fetching", message: `Connecting to ${CHAIN_NAMES[selectedChain]}...` });
      setTransactions([]);
      setSummary(null);

      try {
        const body = selectedChainConfig.inputType === "apiKey"
          ? { apiKey: inputValue.trim() }
          : { address: inputValue.trim() };

        const response = await fetch(`/api/${selectedChain}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.details || "Failed to fetch transactions");
        }

        setFetchState({ status: "processing", message: "Processing transactions..." });

        const result = await response.json();

        // Parse dates from the response
        const txs = result.transactions.map((tx: Record<string, unknown> & { date?: string; timestamp?: string }) => ({
          ...tx,
          date: tx.date ? new Date(tx.date) : undefined,
          timestamp: tx.timestamp ? new Date(tx.timestamp) : undefined,
        })) as (PerpsTransaction | NormalizedTransaction)[];

        setTransactions(txs);
        setSummary(result.summary);

        setFetchState({
          status: "complete",
          message: `Found ${txs.length} transactions`,
        });
      } catch (error) {
        setFetchState({
          status: "error",
          message: error instanceof Error ? error.message : "An unexpected error occurred",
        });
      }
    },
    [inputValue, selectedChain, selectedChainConfig]
  );

  const handleDownloadCSV = useCallback(() => {
    if (!transactions.length || !selectedChainConfig) return;

    let csv: string;
    let filename: string;

    if (selectedChainConfig.isPerps) {
      csv = generateAwakenPerpsCSV(transactions as PerpsTransaction[]);
      filename = `${selectedChain}-perps-awaken.csv`;
    } else {
      csv = generateAwakenCSV(transactions as NormalizedTransaction[]);
      filename = `${selectedChain}-awaken.csv`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [transactions, selectedChain, selectedChainConfig]);

  const isLoading = fetchState.status === "fetching" || fetchState.status === "processing";

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logos/awaken.png"
              alt="Awaken"
              width={32}
              height={32}
              className="rounded-full"
            />
            <span className="text-lg font-semibold text-[var(--foreground)]">Awaken CSV</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://awaken.tax"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)] sm:block"
            >
              Awaken.tax
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
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          {/* Hero */}
          <div className="text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
              Export Crypto Transactions
              <br />
              <span className="text-[var(--accent)]">for Tax Reporting</span>
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-pretty text-[var(--muted)]">
              Select a blockchain, enter your wallet address, and download transactions in{" "}
              <a
                href="https://awaken.tax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                Awaken.tax
              </a>{" "}
              CSV format.
            </p>
          </div>

          {/* Chain Selector */}
          <div className="mt-10">
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
              1. Select blockchain
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 text-left shadow-sm transition-all hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
              >
                {selectedChain ? (
                  <div className="flex items-center gap-3">
                    <ChainLogo chainId={selectedChain} size={28} />
                    <div>
                      <span className="font-medium text-[var(--foreground)]">
                        {CHAIN_NAMES[selectedChain]}
                      </span>
                      <span className="ml-2 text-sm text-[var(--muted)]">
                        {CHAIN_SYMBOLS[selectedChain]}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-[var(--muted)]">Select a blockchain...</span>
                )}
                <ChevronDownIcon className={`size-5 text-[var(--muted)] transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute top-full z-10 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--card)] py-2 shadow-lg">
                  {CHAINS.map((chain) => (
                    <button
                      key={chain.id}
                      type="button"
                      onClick={() => handleChainSelect(chain.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--card-hover)] ${
                        selectedChain === chain.id ? "bg-[var(--accent-muted)]" : ""
                      }`}
                    >
                      <ChainLogo chainId={chain.id} size={32} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--foreground)]">
                            {CHAIN_NAMES[chain.id]}
                          </span>
                          <span className="text-sm text-[var(--muted)]">
                            {CHAIN_SYMBOLS[chain.id]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-[var(--muted)]">
                          {CHAIN_DESCRIPTIONS[chain.id]}
                        </p>
                      </div>
                      {selectedChain === chain.id && (
                        <CheckIcon className="size-5 text-[var(--accent)]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Chain Features */}
            {selectedChainConfig && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedChainConfig.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-[var(--accent-muted)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Input Form - appears after chain selection */}
          {selectedChainConfig && (
            <form onSubmit={handleSubmit} className="mt-8">
              <label htmlFor="walletInput" className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                2. {selectedChainConfig.inputLabel}
              </label>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                <input
                  id="walletInput"
                  type={selectedChainConfig.inputType === "apiKey" ? "password" : "text"}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={selectedChainConfig.inputPlaceholder}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  disabled={isLoading}
                  aria-label={selectedChainConfig.inputLabel}
                />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {selectedChainConfig.inputHelp}
                </p>
                {selectedChainConfig.warning && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                    <WarningIcon className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-xs font-medium text-red-600">
                      {selectedChainConfig.warning}
                    </p>
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isLoading || !inputValue.trim()}
                    className="rounded-lg bg-[var(--foreground)] px-6 py-2.5 text-sm font-medium text-[var(--background)] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? "Fetching..." : "Fetch Transactions"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Progress Indicator */}
          {fetchState.status !== "idle" && fetchState.status !== "complete" && (
            <div className="mt-6">
              <ProgressIndicator status={fetchState.status} message={fetchState.message} />
            </div>
          )}

          {/* Error State */}
          {fetchState.status === "error" && (
            <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-red-500">{fetchState.message}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Please check your input and try again.
              </p>
            </div>
          )}

          {/* Results */}
          {transactions.length > 0 && fetchState.status === "complete" && (
            <div className="mt-8 space-y-4">
              {/* Summary & Download */}
              <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
                <div>
                  <p className="text-sm text-[var(--muted)]">Found</p>
                  <p className="text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                    {transactions.length} transactions
                  </p>
                  {summary?.totalPnL !== undefined && (
                    <p className={`text-sm font-medium tabular-nums ${summary.totalPnL >= 0 ? "text-green-600" : "text-red-500"}`}>
                      P&L: {summary.totalPnL >= 0 ? "+" : ""}{summary.totalPnL.toFixed(2)} USDC
                    </p>
                  )}
                </div>
                <button
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition-all hover:opacity-90"
                >
                  <DownloadIcon />
                  Download CSV
                </button>
              </div>

              {/* Quick Stats */}
              {summary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {summary.totalTrades !== undefined && (
                    <StatCard label="Trades" value={summary.totalTrades} />
                  )}
                  {summary.openPositions !== undefined && (
                    <StatCard label="Opens" value={summary.openPositions} />
                  )}
                  {summary.closePositions !== undefined && (
                    <StatCard label="Closes" value={summary.closePositions} />
                  )}
                  {summary.fundingPayments !== undefined && (
                    <StatCard label="Funding" value={summary.fundingPayments} />
                  )}
                  {summary.totalFees !== undefined && (
                    <StatCard label="Fees" value={`$${summary.totalFees.toFixed(2)}`} isString />
                  )}
                  {summary.tradedAssets && summary.tradedAssets.length > 0 && (
                    <div className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                      <p className="text-xs text-[var(--muted)]">Assets</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {summary.tradedAssets.map((asset) => (
                          <span key={asset} className="rounded bg-[var(--accent-muted)] px-1.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                            {asset}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Transaction Preview */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="mb-3 text-sm font-medium text-[var(--foreground)]">Preview (first 10)</p>
                <div className="space-y-2 text-xs">
                  {transactions.slice(0, 10).map((tx, i) => {
                    const date = 'date' in tx ? tx.date : ('timestamp' in tx ? tx.timestamp : null);
                    const asset = 'asset' in tx ? tx.asset : ('sentCurrency' in tx ? tx.sentCurrency || tx.receivedCurrency : '');
                    return (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--background)] px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[var(--muted)]">
                            {date ? new Date(date).toLocaleDateString() : '-'}
                          </span>
                          <span className="font-medium text-[var(--foreground)]">{asset}</span>
                        </div>
                        {'tag' in tx && (
                          <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[var(--accent)]">
                            {String(tx.tag).replace("_", " ")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {transactions.length > 10 && (
                  <p className="mt-3 text-center text-xs text-[var(--muted)]">
                    +{transactions.length - 10} more transactions in CSV
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {transactions.length === 0 && fetchState.status === "complete" && (
            <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
              <p className="text-lg font-medium text-[var(--foreground)]">No transactions found</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                This {selectedChainConfig?.inputType === "apiKey" ? "account" : "address"} has no transaction history.
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
            <p className="text-xs">Open source • MIT License</p>
          </div>
        </div>
      </footer>

      {/* Click outside to close dropdown */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
}

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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
