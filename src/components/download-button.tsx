"use client";

import { useCallback, useState } from "react";
import type { NormalizedTransaction } from "@/lib/types";
import { generateAwakenCSV, downloadCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";

export interface DownloadButtonProps {
  transactions: NormalizedTransaction[];
  address: string;
  disabled?: boolean;
  chain?: string;
}

export function DownloadButton({ transactions, address, disabled, chain = "bittensor" }: DownloadButtonProps) {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = useCallback(() => {
    if (transactions.length === 0) return;

    const csv = generateAwakenCSV(transactions);
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `${chain}-${address.slice(0, 8)}-${timestamp}-awaken.csv`;

    downloadCSV(csv, filename);
    setDownloaded(true);

    // Reset after 3 seconds
    setTimeout(() => setDownloaded(false), 3000);
  }, [transactions, address]);

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || transactions.length === 0}
      className={cn(
        "group flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-zinc-50 dark:focus:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-50",
        downloaded
          ? "bg-emerald-500 text-white"
          : "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]"
      )}
    >
      {downloaded ? (
        <>
          <CheckIcon />
          <span>Downloaded!</span>
        </>
      ) : (
        <>
          <DownloadIcon />
          <span>Download CSV</span>
        </>
      )}
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform group-hover:translate-y-0.5"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
