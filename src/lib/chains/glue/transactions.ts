// Glue Network transaction normalization to Awaken CSV format

import type { NormalizedTransaction, TransactionType, AwakenTag } from "@/lib/types";
import type { GlueTransaction, GlueTokenTransfer } from "./types";
import { toGlue, normalizeAddress, parseTimestamp, calculateGasCost } from "./utils";

function getTagForType(type: TransactionType): AwakenTag {
  switch (type) {
    case "transfer_sent":
      return "payment";
    case "transfer_received":
      return "receive";
    case "token_sent":
      return "payment";
    case "token_received":
      return "receive";
    default:
      return "payment";
  }
}

/**
 * Normalize a Glue transaction to Awaken format
 */
export function normalizeTransaction(
  tx: GlueTransaction,
  walletAddress: string,
  gluePrice: number | null
): NormalizedTransaction | null {
  const normalizedWallet = normalizeAddress(walletAddress);
  const from = normalizeAddress(tx.from);
  const to = normalizeAddress(tx.to || "");

  // Determine if this is a send or receive
  const isSender = from === normalizedWallet;
  const isReceiver = to === normalizedWallet;

  // Skip if wallet is not involved
  if (!isSender && !isReceiver) {
    return null;
  }

  // Skip failed transactions
  if (tx.isError === "1" || tx.txreceipt_status === "0") {
    return null;
  }

  const value = toGlue(tx.value);
  const gasCost = calculateGasCost(tx.gasUsed, tx.gasPrice);
  const timestamp = parseTimestamp(tx.timeStamp);

  // Self-transfer (same address sends to itself)
  if (isSender && isReceiver) {
    return {
      id: tx.hash,
      type: "transfer_sent",
      timestamp,
      sentAmount: gasCost, // Only gas was spent
      sentCurrency: "GLUE",
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: gasCost,
      feeCurrency: "GLUE",
      transactionHash: tx.hash,
      notes: "Self-transfer (gas only)",
      tag: "payment",
      fiatPrice: gluePrice ?? undefined,
    };
  }

  // Sending transaction
  if (isSender) {
    const type: TransactionType = "transfer_sent";
    const notes = to
      ? `Transfer to ${to.slice(0, 10)}...${to.slice(-6)}`
      : "Contract interaction";

    // If value is 0, it's likely a contract interaction
    if (value === 0) {
      return {
        id: tx.hash,
        type: "transfer_sent",
        timestamp,
        sentAmount: gasCost, // Only gas was spent
        sentCurrency: "GLUE",
        receivedAmount: null,
        receivedCurrency: null,
        feeAmount: gasCost,
        feeCurrency: "GLUE",
        transactionHash: tx.hash,
        notes: "Contract interaction (gas only)",
        tag: "payment",
        fiatPrice: gluePrice ?? undefined,
      };
    }

    return {
      id: tx.hash,
      type,
      timestamp,
      sentAmount: value,
      sentCurrency: "GLUE",
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: gasCost,
      feeCurrency: "GLUE",
      transactionHash: tx.hash,
      notes,
      tag: getTagForType(type),
      fiatPrice: gluePrice ?? undefined,
    };
  }

  // Receiving transaction
  if (isReceiver && value > 0) {
    const type: TransactionType = "transfer_received";
    const notes = from
      ? `Transfer from ${from.slice(0, 10)}...${from.slice(-6)}`
      : "Transfer received";

    return {
      id: tx.hash,
      type,
      timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: value,
      receivedCurrency: "GLUE",
      feeAmount: 0, // Receiver doesn't pay gas
      feeCurrency: "GLUE",
      transactionHash: tx.hash,
      notes,
      tag: getTagForType(type),
      fiatPrice: gluePrice ?? undefined,
    };
  }

  return null;
}

/**
 * Normalize a token transfer to Awaken format
 */
export function normalizeTokenTransfer(
  transfer: GlueTokenTransfer,
  walletAddress: string,
  gluePrice: number | null
): NormalizedTransaction | null {
  const normalizedWallet = normalizeAddress(walletAddress);
  const from = normalizeAddress(transfer.from);
  const to = normalizeAddress(transfer.to);

  const isSender = from === normalizedWallet;
  const isReceiver = to === normalizedWallet;

  if (!isSender && !isReceiver) {
    return null;
  }

  const decimals = parseInt(transfer.tokenDecimal, 10) || 18;
  const amount = Number(BigInt(transfer.value)) / 10 ** decimals;
  const tokenSymbol = transfer.tokenSymbol || "TOKEN";
  const timestamp = parseTimestamp(transfer.timeStamp);
  const gasCost = calculateGasCost(transfer.gasUsed, transfer.gasPrice);

  if (isSender) {
    return {
      id: `${transfer.hash}-${transfer.logIndex}`,
      type: "token_sent",
      timestamp,
      sentAmount: amount,
      sentCurrency: tokenSymbol,
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: gasCost,
      feeCurrency: "GLUE",
      transactionHash: transfer.hash,
      notes: `Token transfer: ${tokenSymbol} to ${to.slice(0, 10)}...`,
      tag: "payment",
      fiatPrice: gluePrice ?? undefined,
    };
  }

  return {
    id: `${transfer.hash}-${transfer.logIndex}`,
    type: "token_received",
    timestamp,
    sentAmount: null,
    sentCurrency: null,
    receivedAmount: amount,
    receivedCurrency: tokenSymbol,
    feeAmount: 0,
    feeCurrency: "GLUE",
    transactionHash: transfer.hash,
    notes: `Token received: ${tokenSymbol} from ${from.slice(0, 10)}...`,
    tag: "receive",
    fiatPrice: gluePrice ?? undefined,
  };
}

/**
 * Process all transactions and return normalized list
 */
export function processTransactions(
  transactions: GlueTransaction[],
  tokenTransfers: GlueTokenTransfer[],
  walletAddress: string,
  gluePrice: number | null
): NormalizedTransaction[] {
  const normalized: NormalizedTransaction[] = [];
  const seenIds = new Set<string>();

  // Process native GLUE transactions
  for (const tx of transactions) {
    if (seenIds.has(tx.hash)) continue;

    const result = normalizeTransaction(tx, walletAddress, gluePrice);
    if (result) {
      seenIds.add(result.id);
      normalized.push(result);
    }
  }

  // Process token transfers
  for (const transfer of tokenTransfers) {
    const id = `${transfer.hash}-${transfer.logIndex}`;
    if (seenIds.has(id)) continue;

    const result = normalizeTokenTransfer(transfer, walletAddress, gluePrice);
    if (result) {
      seenIds.add(result.id);
      normalized.push(result);
    }
  }

  // Sort by timestamp ascending (for Awaken import)
  normalized.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return normalized;
}
