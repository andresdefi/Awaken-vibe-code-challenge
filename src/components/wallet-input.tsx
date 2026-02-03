"use client";

import { useState, useCallback, type FormEvent } from "react";
import { cn } from "@/lib/utils";

export interface WalletInputProps {
  onSubmit: (address: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  // Chain-specific configuration
  validateAddress: (address: string) => boolean;
  placeholder: string;
  exampleAddress: string;
  errorMessage: string;
  ariaLabel: string;
}

export function WalletInput({
  onSubmit,
  isLoading,
  disabled,
  validateAddress,
  placeholder,
  exampleAddress,
  errorMessage,
  ariaLabel,
}: WalletInputProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmedAddress = address.trim();

      if (!trimmedAddress) {
        setError("Please enter a wallet address");
        return;
      }

      if (!validateAddress(trimmedAddress)) {
        setError(errorMessage);
        return;
      }

      onSubmit(trimmedAddress);
    },
    [address, onSubmit, validateAddress, errorMessage]
  );

  const handleTryExample = useCallback(() => {
    setAddress(exampleAddress);
    setError(null);
  }, [exampleAddress]);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            aria-label={ariaLabel}
            aria-invalid={!!error}
            className={cn(
              "w-full rounded-xl border bg-white px-4 py-3.5 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "transition-all duration-150",
              error ? "border-red-500/50" : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
            )}
          />
          {address && !isLoading && (
            <button
              type="button"
              onClick={() => setAddress("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              aria-label="Clear input"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={disabled || isLoading || !address.trim()}
          className={cn(
            "rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-medium text-white",
            "hover:bg-emerald-500 active:bg-emerald-700",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-zinc-50 dark:focus:ring-offset-zinc-950",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-150",
            "min-w-[160px]"
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner />
              <span>Loading...</span>
            </span>
          ) : (
            "Fetch Transactions"
          )}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-400" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
        <span>Try an example:</span>
        <button
          type="button"
          onClick={handleTryExample}
          disabled={isLoading}
          className="font-mono text-emerald-600 hover:text-emerald-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          {exampleAddress.slice(0, 8)}...{exampleAddress.slice(-6)}
        </button>
      </div>
    </form>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="size-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
