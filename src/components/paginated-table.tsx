"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { NormalizedTransaction, PerpsTransaction } from "@/lib/types";
import { calculatePagination } from "@/lib/use-pagination";
import { getExplorerUrl } from "@/lib/chain-config";
import { truncateAddress, formatAmount } from "@/lib/utils";

type Transaction = NormalizedTransaction | PerpsTransaction;

interface PaginatedTableProps {
  transactions: Transaction[];
  chainId: string;
  isPerps: boolean;
}

type SortField = "date" | "type" | "amount" | "fee" | "pnl";
type SortDirection = "asc" | "desc";

function getTxDate(tx: Transaction): Date {
  if ("timestamp" in tx && tx.timestamp) return new Date(tx.timestamp);
  if ("date" in tx && tx.date) return new Date(tx.date);
  return new Date(0);
}

function getTxTag(tx: Transaction): string {
  return "tag" in tx ? String(tx.tag) : "";
}

function getTxAmount(tx: Transaction): number {
  if ("sentAmount" in tx) {
    return Math.abs(tx.sentAmount ?? 0) + Math.abs(tx.receivedAmount ?? 0);
  }
  if ("amount" in tx) return Math.abs(tx.amount);
  return 0;
}

function isAmbiguous(tx: Transaction): boolean {
  return "isAmbiguous" in tx && tx.isAmbiguous === true;
}

function getAmbiguousReasons(tx: Transaction): string[] {
  return "ambiguousReasons" in tx && Array.isArray(tx.ambiguousReasons)
    ? tx.ambiguousReasons
    : [];
}

function getSearchableText(tx: Transaction): string {
  const parts: string[] = [];

  // Transaction hash and notes
  if ("transactionHash" in tx) parts.push(tx.transactionHash);
  if ("notes" in tx) parts.push(tx.notes);

  // Tag and type
  parts.push(getTxTag(tx));
  if ("type" in tx) parts.push(String(tx.type));

  // Normal transaction currencies
  if ("sentCurrency" in tx && tx.sentCurrency) parts.push(tx.sentCurrency);
  if ("receivedCurrency" in tx && tx.receivedCurrency) parts.push(tx.receivedCurrency);
  if ("feeCurrency" in tx) parts.push(tx.feeCurrency);

  // Perps transaction fields
  if ("asset" in tx) parts.push(tx.asset);
  if ("paymentToken" in tx) parts.push(tx.paymentToken);

  return parts.join(" ").toLowerCase();
}

export function PaginatedTable({ transactions, chainId, isPerps }: PaginatedTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAmbiguousOnly, setShowAmbiguousOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search with 300ms delay
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Collect unique tags for filter tabs
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let ambiguousCount = 0;
    for (const tx of transactions) {
      const tag = getTxTag(tx);
      counts.set(tag, (counts.get(tag) || 0) + 1);
      if (isAmbiguous(tx)) ambiguousCount++;
    }
    return { tags: counts, ambiguous: ambiguousCount };
  }, [transactions]);

  // Filter
  const filtered = useMemo(() => {
    let result = transactions;
    if (showAmbiguousOnly) {
      result = result.filter(isAmbiguous);
    } else if (typeFilter !== "all") {
      result = result.filter((tx) => getTxTag(tx) === typeFilter);
    }
    // Apply text search filter
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase().trim();
      result = result.filter((tx) => getSearchableText(tx).includes(searchLower));
    }
    return result;
  }, [transactions, typeFilter, showAmbiguousOnly, debouncedSearch]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = getTxDate(a).getTime() - getTxDate(b).getTime();
          break;
        case "amount":
          cmp = getTxAmount(a) - getTxAmount(b);
          break;
        case "fee": {
          const feeA = "feeAmount" in a ? a.feeAmount : "fee" in a ? a.fee : 0;
          const feeB = "feeAmount" in b ? b.feeAmount : "fee" in b ? b.fee : 0;
          cmp = feeA - feeB;
          break;
        }
        case "pnl": {
          const pnlA = "pnl" in a ? a.pnl : 0;
          const pnlB = "pnl" in b ? b.pnl : 0;
          cmp = pnlA - pnlB;
          break;
        }
        case "type":
          cmp = getTxTag(a).localeCompare(getTxTag(b));
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDirection]);

  // Paginate
  const pagination = calculatePagination(sorted.length, pageSize, currentPage);
  const pageData = sorted.slice(pagination.startIndex, pagination.endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="cursor-pointer px-3 py-2 text-left text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-[var(--accent)]">{sortDirection === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <button
          type="button"
          onClick={() => { setTypeFilter("all"); setShowAmbiguousOnly(false); setCurrentPage(1); }}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            typeFilter === "all" && !showAmbiguousOnly
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          All ({transactions.length})
        </button>
        {Array.from(tagCounts.tags.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              onClick={() => { setTypeFilter(tag); setShowAmbiguousOnly(false); setCurrentPage(1); }}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                typeFilter === tag && !showAmbiguousOnly
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {tag.replace(/_/g, " ")} ({count})
            </button>
          ))}
        {tagCounts.ambiguous > 0 && (
          <button
            type="button"
            onClick={() => { setShowAmbiguousOnly(true); setTypeFilter("all"); setCurrentPage(1); }}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              showAmbiguousOnly
                ? "bg-amber-500 text-white"
                : "text-amber-500 hover:bg-amber-500/10"
            }`}
          >
            Needs Review ({tagCounts.ambiguous})
          </button>
        )}
        {/* Search input */}
        <div className="ml-auto flex items-center gap-2">
          {debouncedSearch && (
            <span className="text-xs text-[var(--muted)]">
              {filtered.length} of {transactions.length}
            </span>
          )}
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-40 rounded-lg border border-[var(--border)] bg-[var(--background)] py-1.5 pl-8 pr-3 text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              aria-label="Search transactions"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <SortHeader field="date" label="Date" />
              {isPerps ? (
                <>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)]">Asset</th>
                  <SortHeader field="amount" label="Amount" />
                  <SortHeader field="pnl" label="P&L" />
                </>
              ) : (
                <>
                  <SortHeader field="type" label="Type" />
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)]">Sent</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)]">Received</th>
                </>
              )}
              <SortHeader field="fee" label="Fee" />
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)]">Hash</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)]">Tag</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--muted)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((tx, i) => {
              const date = getTxDate(tx);
              const tag = getTxTag(tx);
              const hash = "transactionHash" in tx ? tx.transactionHash : "";
              const explorerUrl = getExplorerUrl(chainId, hash);
              const amb = isAmbiguous(tx);
              const reasons = getAmbiguousReasons(tx);

              return (
                <tr
                  key={`${hash}-${i}`}
                  className={`border-b border-[var(--border)] last:border-0 ${
                    amb ? "bg-amber-500/5" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--foreground)]">
                    {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  {isPerps ? (
                    <>
                      <td className="px-3 py-2 font-medium text-[var(--foreground)]">
                        {"asset" in tx ? tx.asset : ""}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[var(--foreground)]">
                        {"amount" in tx ? formatAmount(tx.amount) : ""}
                      </td>
                      <td className={`px-3 py-2 tabular-nums font-medium ${
                        "pnl" in tx
                          ? tx.pnl > 0 ? "text-green-500" : tx.pnl < 0 ? "text-red-500" : "text-[var(--muted)]"
                          : ""
                      }`}>
                        {"pnl" in tx
                          ? tx.pnl > 0 ? `+${formatAmount(tx.pnl)}` : formatAmount(tx.pnl)
                          : ""}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-[var(--foreground)]">
                        {"type" in tx ? String(tx.type).replace(/_/g, " ") : ""}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[var(--foreground)]">
                        {"sentAmount" in tx && tx.sentAmount
                          ? `${formatAmount(tx.sentAmount)} ${tx.sentCurrency || ""}`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[var(--foreground)]">
                        {"receivedAmount" in tx && tx.receivedAmount
                          ? `${formatAmount(tx.receivedAmount)} ${tx.receivedCurrency || ""}`
                          : "-"}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 tabular-nums text-[var(--muted)]">
                    {"feeAmount" in tx && tx.feeAmount > 0
                      ? `${formatAmount(tx.feeAmount)} ${tx.feeCurrency}`
                      : "fee" in tx && tx.fee > 0
                        ? formatAmount(tx.fee)
                        : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {hash ? (
                      explorerUrl ? (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent)] hover:underline"
                        >
                          {truncateAddress(hash, 4)}
                        </a>
                      ) : (
                        <span className="text-[var(--muted)]">{truncateAddress(hash, 4)}</span>
                      )
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-xs text-[var(--accent)]">
                      {tag.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {amb ? (
                      <span
                        className="cursor-help rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500"
                        title={reasons.join("; ")}
                      >
                        Review
                      </span>
                    ) : (
                      <span className="text-xs text-green-500">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>
            {pagination.startIndex + 1}-{pagination.endIndex} of {sorted.length}
          </span>
          <span className="text-[var(--border)]">|</span>
          {[25, 50, 100].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => handlePageSizeChange(size)}
              className={`rounded px-2 py-0.5 transition-colors ${
                pageSize === size
                  ? "bg-[var(--accent)] text-white"
                  : "hover:text-[var(--foreground)]"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={!pagination.hasPrev}
            className="rounded px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
            aria-label="Previous page"
          >
            Prev
          </button>
          {pagination.pages.map((page, i) =>
            page === "ellipsis" ? (
              <span key={`e-${i}`} className="px-1 text-xs text-[var(--muted)]">...</span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  page === currentPage
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!pagination.hasNext}
            className="rounded px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
