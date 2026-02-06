// Ergo transaction normalization to Awaken CSV format

import type { NormalizedTransaction, TransactionType, AwakenTag } from "@/lib/types";
import type { ErgoTransaction, ErgoInput, ErgoOutput } from "./types";
import { toErg, normalizeAddress, parseTimestamp, formatTokenAmount } from "./utils";

function getTagForType(type: TransactionType): AwakenTag {
  switch (type) {
    case "transfer_sent":
      return "payment";
    case "transfer_received":
      return "receive";
    default:
      return "payment";
  }
}

/**
 * Calculate the net ERG flow for a wallet address in a transaction
 * Returns positive for received, negative for sent
 */
function calculateNetFlow(
  tx: ErgoTransaction,
  walletAddress: string
): { sent: number; received: number; fee: number } {
  const normalizedWallet = normalizeAddress(walletAddress);
  let totalInputFromWallet = 0;
  let totalOutputToWallet = 0;
  let totalInputs = 0;
  let totalOutputs = 0;

  // Sum inputs from this wallet
  for (const input of tx.inputs) {
    const inputAddress = normalizeAddress(input.address || "");
    const amount = input.value || 0;
    totalInputs += amount;

    if (inputAddress === normalizedWallet) {
      totalInputFromWallet += amount;
    }
  }

  // Sum outputs to this wallet
  for (const output of tx.outputs) {
    const outputAddress = normalizeAddress(output.address || "");
    const amount = output.value || 0;
    totalOutputs += amount;

    if (outputAddress === normalizedWallet) {
      totalOutputToWallet += amount;
    }
  }

  // Fee is the difference between inputs and outputs
  const fee = Math.max(0, totalInputs - totalOutputs);

  // If wallet provided inputs, they sent something
  // Net sent = what we put in - what we got back (change)
  const sent = totalInputFromWallet > 0
    ? Math.max(0, totalInputFromWallet - totalOutputToWallet)
    : 0;

  // If wallet received outputs but didn't provide inputs, they received
  // Or if wallet received more than they put in
  const received = totalInputFromWallet === 0 && totalOutputToWallet > 0
    ? totalOutputToWallet
    : totalInputFromWallet > 0 && totalOutputToWallet > totalInputFromWallet
      ? totalOutputToWallet - totalInputFromWallet
      : 0;

  return {
    sent: toErg(sent),
    received: toErg(received),
    fee: sent > 0 ? toErg(fee) : 0, // Only attribute fee if we sent
  };
}

/**
 * Check if transaction is a mining reward (coinbase)
 * Mining rewards have no inputs
 */
function isMiningReward(tx: ErgoTransaction): boolean {
  return tx.inputs.length === 0;
}

/**
 * Get the counterparty address for a transaction
 */
function getCounterparty(
  tx: ErgoTransaction,
  walletAddress: string,
  isSending: boolean
): string {
  const normalizedWallet = normalizeAddress(walletAddress);

  if (isSending) {
    // Find the output that isn't to our wallet (the recipient)
    for (const output of tx.outputs) {
      const outputAddress = normalizeAddress(output.address || "");
      if (outputAddress && outputAddress !== normalizedWallet) {
        return output.address || "";
      }
    }
  } else {
    // Find the input that isn't from our wallet (the sender)
    for (const input of tx.inputs) {
      const inputAddress = normalizeAddress(input.address || "");
      if (inputAddress && inputAddress !== normalizedWallet) {
        return input.address || "";
      }
    }
  }

  return "";
}

/**
 * Check for token transfers in the transaction
 */
function getTokenTransfers(
  tx: ErgoTransaction,
  walletAddress: string
): { sent: { amount: number; name: string } | null; received: { amount: number; name: string } | null } {
  const normalizedWallet = normalizeAddress(walletAddress);
  let sent: { amount: number; name: string } | null = null;
  let received: { amount: number; name: string } | null = null;

  // Check outputs for tokens sent TO wallet
  for (const output of tx.outputs) {
    const outputAddress = normalizeAddress(output.address || "");
    if (outputAddress === normalizedWallet && output.assets && output.assets.length > 0) {
      const token = output.assets[0];
      const amount = formatTokenAmount(token.amount, token.decimals || 0);
      const name = token.name || token.tokenId.slice(0, 8);
      received = { amount, name };
      break;
    }
  }

  // Check inputs for tokens sent FROM wallet
  for (const input of tx.inputs) {
    const inputAddress = normalizeAddress(input.address || "");
    if (inputAddress === normalizedWallet && input.assets && input.assets.length > 0) {
      const token = input.assets[0];
      const amount = formatTokenAmount(token.amount, token.decimals || 0);
      const name = token.name || token.tokenId.slice(0, 8);
      sent = { amount, name };
      break;
    }
  }

  return { sent, received };
}

/**
 * Normalize an Ergo transaction to Awaken format
 */
export function normalizeTransaction(
  tx: ErgoTransaction,
  walletAddress: string,
  ergPrice: number | null
): NormalizedTransaction | null {
  const { sent, received, fee } = calculateNetFlow(tx, walletAddress);

  // Skip if no ERG movement for this wallet
  if (sent === 0 && received === 0) {
    // Check for token-only transfers
    const tokenTransfers = getTokenTransfers(tx, walletAddress);
    if (!tokenTransfers.sent && !tokenTransfers.received) {
      return null;
    }

    // Token-only transaction
    const timestamp = parseTimestamp(tx.timestamp);
    const type: TransactionType = tokenTransfers.sent ? "token_sent" : "token_received";

    return {
      id: tx.id,
      type,
      timestamp,
      sentAmount: tokenTransfers.sent?.amount || null,
      sentCurrency: tokenTransfers.sent?.name || null,
      receivedAmount: tokenTransfers.received?.amount || null,
      receivedCurrency: tokenTransfers.received?.name || null,
      feeAmount: fee,
      feeCurrency: "ERG",
      transactionHash: tx.id,
      notes: tokenTransfers.sent
        ? `Token transfer: ${tokenTransfers.sent.name}`
        : `Token received: ${tokenTransfers.received?.name}`,
      tag: getTagForType(type),
      fiatPrice: ergPrice ?? undefined,
    };
  }

  // Determine transaction type
  let type: TransactionType;
  let notes: string;

  if (isMiningReward(tx)) {
    type = "transfer_received";
    notes = "Mining reward";
  } else if (sent > 0 && received === 0) {
    type = "transfer_sent";
    const recipient = getCounterparty(tx, walletAddress, true);
    notes = recipient
      ? `Transfer to ${recipient.slice(0, 12)}...`
      : "Transfer sent";
  } else if (received > 0 && sent === 0) {
    type = "transfer_received";
    const sender = getCounterparty(tx, walletAddress, false);
    notes = sender
      ? `Transfer from ${sender.slice(0, 12)}...`
      : "Transfer received";
  } else {
    // Both sent and received - could be consolidation or complex tx
    if (sent > received) {
      type = "transfer_sent";
      notes = "Net transfer out";
    } else {
      type = "transfer_received";
      notes = "Net transfer in";
    }
  }

  // Timestamp is in milliseconds
  const timestamp = parseTimestamp(tx.timestamp);

  return {
    id: tx.id,
    type,
    timestamp,
    sentAmount: sent > 0 ? sent : null,
    sentCurrency: sent > 0 ? "ERG" : null,
    receivedAmount: received > 0 ? received : null,
    receivedCurrency: received > 0 ? "ERG" : null,
    feeAmount: fee,
    feeCurrency: "ERG",
    transactionHash: tx.id,
    notes,
    tag: getTagForType(type),
    fiatPrice: ergPrice ?? undefined,
  };
}

/**
 * Process all transactions and return normalized list
 */
export function processTransactions(
  transactions: ErgoTransaction[],
  walletAddress: string,
  ergPrice: number | null
): NormalizedTransaction[] {
  const normalized: NormalizedTransaction[] = [];
  const seenIds = new Set<string>();

  for (const tx of transactions) {
    // Deduplicate by transaction ID
    if (seenIds.has(tx.id)) {
      continue;
    }
    seenIds.add(tx.id);

    const result = normalizeTransaction(tx, walletAddress, ergPrice);
    if (result) {
      normalized.push(result);
    }
  }

  // Sort by timestamp ascending (for Awaken import)
  normalized.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return normalized;
}
