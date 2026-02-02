"use client";

import { cn } from "@/lib/utils";

export function TableSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-6 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 w-16 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
          <div className="flex gap-4">
            {[120, 60, 80, 60, 80, 60].map((w, i) => (
              <div key={i} className="h-4 rounded bg-zinc-200 dark:bg-zinc-800" style={{ width: w }} />
            ))}
          </div>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 bg-white px-4 py-4 dark:bg-zinc-950">
              <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-zinc-200 dark:bg-zinc-800", className)} />
  );
}
