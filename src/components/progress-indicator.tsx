"use client";

import { cn } from "@/lib/utils";

export interface ProgressIndicatorProps {
  status: "idle" | "fetching" | "processing" | "complete" | "error";
  message?: string;
}

export function ProgressIndicator({ status, message }: ProgressIndicatorProps) {
  if (status === "idle") return null;

  const statusConfig = {
    fetching: {
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      borderColor: "border-emerald-400/20",
      icon: <SpinnerIcon />,
      defaultMessage: "Fetching transactions from Taostats API...",
    },
    processing: {
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      borderColor: "border-blue-400/20",
      icon: <SpinnerIcon />,
      defaultMessage: "Processing and normalizing transactions...",
    },
    complete: {
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      borderColor: "border-emerald-400/20",
      icon: <CheckIcon />,
      defaultMessage: "Transactions loaded successfully!",
    },
    error: {
      color: "text-red-400",
      bgColor: "bg-red-400/10",
      borderColor: "border-red-400/20",
      icon: <ErrorIcon />,
      defaultMessage: "An error occurred while fetching transactions.",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3",
        config.bgColor,
        config.borderColor
      )}
    >
      <span className={config.color}>{config.icon}</span>
      <p className={cn("text-sm", config.color)}>{message || config.defaultMessage}</p>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="size-5 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
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

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
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

function ErrorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" x2="9" y1="9" y2="15" />
      <line x1="9" x2="15" y1="9" y2="15" />
    </svg>
  );
}
