"use client";

import { useState, useMemo } from "react";
import type { NormalizedTransaction } from "@/lib/types";
import { cn, formatDate, formatAmount, truncateAddress } from "@/lib/utils";

export interface TransactionTableProps {
  transactions: NormalizedTransaction[];
}

type SortField = "timestamp" | "type" | "amount";
type SortDirection = "asc" | "desc";

const TYPE_LABELS: Record<string, string> = {
  transfer_sent: "Sent",
  transfer_received: "Received",
  stake: "Stake",
  unstake: "Unstake",
  emission_reward: "Reward",
};

const TYPE_COLORS: Record<string, string> = {
  transfer_sent: "text-red-400",
  transfer_received: "text-emerald-400",
  stake: "text-blue-400",
  unstake: "text-orange-400",
  emission_reward: "text-purple-400",
};

const TYPE_BG_COLORS: Record<string, string> = {
  transfer_sent: "bg-red-400/10",
  transfer_received: "bg-emerald-400/10",
  stake: "bg-blue-400/10",
  unstake: "bg-orange-400/10",
  emission_reward: "bg-purple-400/10",
};

export function TransactionTable({ transactions }: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: transactions.length };
    for (const tx of transactions) {
      c[tx.type] = (c[tx.type] || 0) + 1;
    }
    return c;
  }, [transactions]);

  const filteredAndSorted = useMemo(() => {
    let result = [...transactions];

    if (filter !== "all") {
      result = result.filter((tx) => tx.type === filter);
    }

    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "timestamp":
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "amount":
          const amountA = a.sentAmount || a.receivedAmount || 0;
          const amountB = b.sentAmount || b.receivedAmount || 0;
          comparison = amountA - amountB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [transactions, sortField, sortDirection, filter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const summary = useMemo(() => {
    const sent = transactions
      .filter((tx) => tx.sentAmount !== null)
      .reduce((sum, tx) => sum + (tx.sentAmount || 0), 0);
    const received = transactions
      .filter((tx) => tx.receivedAmount !== null)
      .reduce((sum, tx) => sum + (tx.receivedAmount || 0), 0);
    const fees = transactions.reduce((sum, tx) => sum + tx.feeAmount, 0);
    const rewards = transactions
      .filter((tx) => tx.type === "emission_reward")
      .reduce((sum, tx) => sum + (tx.receivedAmount || 0), 0);

    return { sent, received, fees, rewards };
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-zinc-500 dark:text-zinc-400">No transactions found for this address.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="Total Sent"
          value={summary.sent}
          color="text-red-400"
          icon={<ArrowUpIcon />}
        />
        <SummaryCard
          label="Total Received"
          value={summary.received}
          color="text-emerald-400"
          icon={<ArrowDownIcon />}
        />
        <SummaryCard
          label="Staking Rewards"
          value={summary.rewards}
          color="text-purple-400"
          icon={<SparkleIcon />}
          highlight
        />
        <SummaryCard
          label="Total Fees"
          value={summary.fees}
          color="text-zinc-400"
          icon={<ReceiptIcon />}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {["all", "transfer_sent", "transfer_received", "stake", "unstake", "emission_reward"].map(
          (f) => {
            const count = counts[f] || 0;
            if (f !== "all" && count === 0) return null;

            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
                  filter === f
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                    : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 hover:text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                )}
              >
                <span>{f === "all" ? "All" : TYPE_LABELS[f]}</span>
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  filter === f ? "bg-white/20" : "bg-zinc-300 dark:bg-zinc-700"
                )}>
                  {count}
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
                <SortableHeader
                  label="Date"
                  field="timestamp"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Type"
                  field="type"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Amount"
                  field="amount"
                  currentField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Fee</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Hash</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {filteredAndSorted.map((tx) => (
                <tr
                  key={tx.id}
                  className="bg-white transition-colors hover:bg-zinc-50 dark:bg-zinc-950/50 dark:hover:bg-zinc-900/50"
                >
                  <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatDate(tx.timestamp)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn(
                      "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
                      TYPE_COLORS[tx.type],
                      TYPE_BG_COLORS[tx.type]
                    )}>
                      {TYPE_LABELS[tx.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums font-medium">
                    {tx.sentAmount !== null && (
                      <span className="text-red-400">
                        -{formatAmount(tx.sentAmount)} TAO
                      </span>
                    )}
                    {tx.receivedAmount !== null && (
                      <span className="text-emerald-400">
                        +{formatAmount(tx.receivedAmount)} TAO
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-zinc-500">
                    {tx.feeAmount > 0 ? `${formatAmount(tx.feeAmount)}` : "-"}
                  </td>
                  <td className="px-4 py-3.5">
                    {tx.transactionHash ? (
                      <a
                        href={`https://taostats.io/extrinsic/${tx.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
                      >
                        {truncateAddress(tx.transactionHash, 4)}
                      </a>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {tx.tag}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Showing {filteredAndSorted.length} of {transactions.length} transactions
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 transition-all",
      highlight
        ? "border-purple-500/30 bg-purple-50 dark:bg-purple-500/5"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50"
    )}>
      <div className="flex items-center gap-2">
        <span className={cn("opacity-60", color)}>{icon}</span>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
      <p className={cn("mt-2 text-xl font-semibold tabular-nums", color)}>
        {formatAmount(value)}
        <span className="ml-1 text-sm font-normal text-zinc-500">TAO</span>
      </p>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onSort,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentField === field;

  return (
    <th
      onClick={() => onSort(field)}
      className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300"
    >
      <span className="flex items-center gap-1">
        {label}
        <span className={cn(
          "transition-opacity",
          isActive ? "opacity-100" : "opacity-0"
        )}>
          {direction === "asc" ? (
            <ChevronUpIcon />
          ) : (
            <ChevronDownIcon />
          )}
        </span>
      </span>
    </th>
  );
}

// Icons
function ArrowUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
