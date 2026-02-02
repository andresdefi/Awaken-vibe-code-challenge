import type { NormalizedTransaction, AwakenCSVRow } from "./types";
import { formatDate, formatAmount } from "./utils";

export function transactionToAwakenRow(tx: NormalizedTransaction): AwakenCSVRow {
  const fiatMultiplier = tx.fiatPrice || 0;

  return {
    Date: formatDate(tx.timestamp),
    "Received Quantity": tx.receivedAmount !== null ? formatAmount(tx.receivedAmount) : "",
    "Received Currency": tx.receivedCurrency || "",
    "Received Fiat Amount":
      tx.receivedAmount !== null && fiatMultiplier
        ? (tx.receivedAmount * fiatMultiplier).toFixed(2)
        : "",
    "Sent Quantity": tx.sentAmount !== null ? formatAmount(tx.sentAmount) : "",
    "Sent Currency": tx.sentCurrency || "",
    "Sent Fiat Amount":
      tx.sentAmount !== null && fiatMultiplier
        ? (tx.sentAmount * fiatMultiplier).toFixed(2)
        : "",
    "Fee Amount": tx.feeAmount > 0 ? formatAmount(tx.feeAmount) : "",
    "Fee Currency": tx.feeAmount > 0 ? tx.feeCurrency : "",
    "Transaction Hash": tx.transactionHash,
    Notes: tx.notes,
    Tag: tx.tag,
  };
}

function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function generateAwakenCSV(transactions: NormalizedTransaction[]): string {
  const headers = [
    "Date",
    "Received Quantity",
    "Received Currency",
    "Received Fiat Amount",
    "Sent Quantity",
    "Sent Currency",
    "Sent Fiat Amount",
    "Fee Amount",
    "Fee Currency",
    "Transaction Hash",
    "Notes",
    "Tag",
  ];

  const rows = transactions.map((tx) => {
    const row = transactionToAwakenRow(tx);
    return headers.map((h) => escapeCSVField(row[h as keyof AwakenCSVRow] || "")).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function downloadCSV(csv: string, filename: string): void {
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
}
