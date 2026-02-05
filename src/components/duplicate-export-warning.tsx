"use client";

import { useEffect, useRef } from "react";
import type { ExportRecord } from "@/lib/export-history";

interface DuplicateExportWarningProps {
  open: boolean;
  previousExport: ExportRecord | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function formatExportDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DuplicateExportWarning({
  open,
  previousExport,
  onCancel,
  onConfirm,
}: DuplicateExportWarningProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-0 shadow-xl backdrop:bg-black/50"
    >
      <div className="w-full max-w-md p-6">
        {/* Warning icon */}
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-500/10">
          <WarningIcon className="size-6 text-amber-500" />
        </div>

        {/* Title */}
        <h2 className="text-center text-lg font-semibold text-[var(--foreground)]">
          Duplicate Export Detected
        </h2>

        {/* Message */}
        <p className="mt-3 text-center text-sm text-[var(--muted)]">
          You already exported this data on{" "}
          <span className="font-medium text-[var(--foreground)]">
            {previousExport ? formatExportDate(previousExport.exportedAt) : "a previous date"}
          </span>
          . Re-importing this CSV into Awaken may create duplicate transactions.
        </p>

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--card-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            Export Anyway
          </button>
        </div>
      </div>
    </dialog>
  );
}

function WarningIcon({ className }: { className?: string }) {
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
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
