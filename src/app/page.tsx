"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ChainConfig } from "@/lib/types";

const CHAINS: ChainConfig[] = [
  {
    id: "bittensor",
    name: "Bittensor",
    symbol: "TAO",
    icon: "τ",
    description: "Export transfers, staking events, and emission rewards",
    features: ["Transfers", "Staking", "Emission Rewards", "USD Prices"],
    enabled: true,
  },
  {
    id: "polkadot",
    name: "Polkadot",
    symbol: "DOT",
    icon: "●",
    description: "Export transfers, staking rewards, and slashing events",
    features: ["Transfers", "Staking", "Rewards", "Slashing", "USD Prices"],
    enabled: true,
  },
  {
    id: "kusama",
    name: "Kusama",
    symbol: "KSM",
    icon: "◆",
    description: "Export transfers, staking, crowdloans, and auction bids",
    features: ["Transfers", "Staking", "Crowdloans", "Auctions", "USD Prices"],
    enabled: true,
  },
  {
    id: "osmosis",
    name: "Osmosis",
    symbol: "OSMO",
    icon: "⚗",
    description: "Export transfers, swaps, LP positions, and staking rewards",
    features: ["Transfers", "Swaps", "LP Positions", "Staking", "IBC", "USD Prices"],
    enabled: true,
  },
  {
    id: "injective",
    name: "Injective",
    symbol: "INJ",
    icon: "◇",
    description: "Export transfers, staking, IBC, and trading activity",
    features: ["Transfers", "Staking", "IBC", "Trading", "USD Prices"],
    enabled: true,
  },
  {
    id: "ronin",
    name: "Ronin",
    symbol: "RON",
    icon: "⬡",
    description: "Export transfers, swaps, NFT trades, and gaming transactions",
    features: ["Transfers", "Swaps", "NFTs", "Staking", "Gaming", "USD Prices"],
    enabled: true,
  },
  {
    id: "extended",
    name: "Extended",
    symbol: "PERPS",
    icon: "◈",
    description: "Export perpetuals trades, positions, and funding payments",
    features: ["Trades", "Positions", "Funding", "P&L", "API Key Required"],
    enabled: true,
  },
  {
    id: "dydx",
    name: "dYdX",
    symbol: "DYDX",
    icon: "◆",
    description: "Export perpetuals trades, positions, and funding payments",
    features: ["Trades", "Positions", "Funding", "P&L", "No API Key"],
    enabled: true,
  },
  {
    id: "canton",
    name: "Canton Network",
    symbol: "CC",
    icon: "◎",
    description: "Export Canton Coin transfers, rewards, and fees",
    features: ["Transfers", "Rewards", "Fees", "Locked CC"],
    enabled: true,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/20">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Awaken Tax CSV</h1>
              <p className="text-xs text-zinc-500">Multi-chain transaction exporter</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://awaken.tax"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs text-zinc-500 hover:text-zinc-400 dark:hover:text-zinc-300 sm:block"
            >
              For Awaken.tax
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
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Open source tax CSV exporter
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
              Export Crypto Transactions
              <br />
              <span className="text-emerald-600 dark:text-emerald-400">for Tax Reporting</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-zinc-600 dark:text-zinc-400">
              Fetch wallet transactions from multiple blockchains and export them in{" "}
              <a
                href="https://awaken.tax"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Awaken.tax
              </a>{" "}
              CSV format for easy tax reporting.
            </p>
          </div>

          {/* Chain Cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CHAINS.map((chain) => (
              <ChainCard key={chain.id} chain={chain} />
            ))}
          </div>

          {/* Info Section */}
          <div className="mt-12 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">How it works</h3>
            <ol className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">1</span>
                <span>Select a blockchain and enter your wallet address</span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">2</span>
                <span>We fetch all transactions including transfers, staking, and rewards</span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">3</span>
                <span>Download the CSV file formatted for Awaken.tax</span>
              </li>
            </ol>
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
                className="text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Awaken.tax
              </a>{" "}
              vibe coding challenge
            </p>
            <p className="text-xs">
              Open source • MIT License
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChainCard({ chain }: { chain: ChainConfig }) {
  const content = (
    <div className={`group relative rounded-xl border p-6 transition-all ${
      chain.enabled
        ? "border-zinc-200 bg-white hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-emerald-500/50"
        : "border-zinc-200 bg-zinc-100 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/20"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-100 text-2xl dark:bg-zinc-800">
          {chain.icon}
        </div>
        {!chain.enabled && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
            Coming Soon
          </span>
        )}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {chain.name}
        <span className="ml-2 text-sm font-normal text-zinc-500">{chain.symbol}</span>
      </h3>
      <p className="mt-1 text-sm text-zinc-500">{chain.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {chain.features.map((feature) => (
          <span
            key={feature}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {feature}
          </span>
        ))}
      </div>
      {chain.enabled && (
        <div className="mt-4 flex items-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Export transactions
          <svg className="ml-1 size-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );

  if (chain.enabled) {
    return <Link href={`/${chain.id}`}>{content}</Link>;
  }

  return content;
}
