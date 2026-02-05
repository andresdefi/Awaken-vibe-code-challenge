// Kaspa transaction normalization

import type { NormalizedTransaction, TransactionType, AwakenTag } from "@/lib/types";
import type { KaspaTransaction } from "./types";
import { sompiToKas, normalizeAddress } from "./utils";

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
 * Determine if a transaction is a coinbase (mining reward)
 * Coinbase transactions have no inputs
 */
function isCoinbase(tx: KaspaTransaction): boolean {
  return tx.inputs.length === 0;
}

/**
 * Calculate the net flow for a wallet address in a transaction
 * Returns positive for received, negative for sent
 */
function calculateNetFlow(
  tx: KaspaTransaction,
  walletAddress: string
): { sent: number; received: number; fee: number } {
  const normalizedWallet = normalizeAddress(walletAddress);
  let totalInputFromWallet = 0;
  let totalOutputToWallet = 0;
  let totalInputs = 0;
  let totalOutputs = 0;

  // Sum inputs from this wallet
  for (const input of tx.inputs) {
    const inputAddress = normalizeAddress(input.previous_outpoint_address);
    const amount = input.previous_outpoint_amount;
    totalInputs += amount;

    if (inputAddress === normalizedWallet) {
      totalInputFromWallet += amount;
    }
  }

  // Sum outputs to this wallet
  for (const output of tx.outputs) {
    const outputAddress = normalizeAddress(output.script_public_key_address);
    const amount = output.amount;
    totalOutputs += amount;

    if (outputAddress === normalizedWallet) {
      totalOutputToWallet += amount;
    }
  }

  // Fee is the difference between inputs and outputs
  const fee = totalInputs - totalOutputs;

  // If wallet provided inputs, they sent something
  // Net sent = what we put in - what we got back (change)
  // If wallet received outputs but didn't provide inputs, they received
  const sent = totalInputFromWallet > 0
    ? Math.max(0, totalInputFromWallet - totalOutputToWallet)
    : 0;

  const received = totalInputFromWallet === 0 && totalOutputToWallet > 0
    ? totalOutputToWallet
    : totalInputFromWallet > 0 && totalOutputToWallet > totalInputFromWallet
      ? totalOutputToWallet - totalInputFromWallet
      : 0;

  return {
    sent: sompiToKas(sent),
    received: sompiToKas(received),
    fee: sent > 0 ? sompiToKas(fee) : 0, // Only attribute fee if we sent
  };
}

/**
 * Get the counterparty address for a transaction
 */
function getCounterparty(
  tx: KaspaTransaction,
  walletAddress: string,
  isSending: boolean
): string {
  const normalizedWallet = normalizeAddress(walletAddress);

  if (isSending) {
    // Find the output that isn't to our wallet (the recipient)
    for (const output of tx.outputs) {
      const outputAddress = normalizeAddress(output.script_public_key_address);
      if (outputAddress !== normalizedWallet) {
        return output.script_public_key_address;
      }
    }
  } else {
    // Find the input that isn't from our wallet (the sender)
    for (const input of tx.inputs) {
      const inputAddress = normalizeAddress(input.previous_outpoint_address);
      if (inputAddress !== normalizedWallet) {
        return input.previous_outpoint_address;
      }
    }
  }

  return "";
}

/**
 * Normalize a Kaspa transaction to Awaken format
 */
export function normalizeTransaction(
  tx: KaspaTransaction,
  walletAddress: string,
  kasPrice: number | null
): NormalizedTransaction | null {
  // Skip unaccepted transactions
  if (!tx.is_accepted) {
    return null;
  }

  const { sent, received, fee } = calculateNetFlow(tx, walletAddress);

  // Skip if no movement for this wallet
  if (sent === 0 && received === 0) {
    return null;
  }

  // Determine transaction type
  let type: TransactionType;
  let notes: string;

  if (isCoinbase(tx)) {
    type = "transfer_received";
    notes = "Mining reward";
  } else if (sent > 0 && received === 0) {
    type = "transfer_sent";
    const recipient = getCounterparty(tx, walletAddress, true);
    notes = recipient
      ? `Transfer to ${recipient.slice(0, 16)}...`
      : "Transfer sent";
  } else if (received > 0 && sent === 0) {
    type = "transfer_received";
    const sender = getCounterparty(tx, walletAddress, false);
    notes = sender
      ? `Transfer from ${sender.slice(0, 16)}...`
      : "Transfer received";
  } else {
    // Both sent and received - could be consolidation or complex tx
    if (sent > received) {
      type = "transfer_sent";
      notes = `Net transfer out (consolidation)`;
    } else {
      type = "transfer_received";
      notes = `Net transfer in`;
    }
  }

  // Timestamp is in milliseconds
  const timestamp = new Date(tx.block_time);

  return {
    id: tx.transaction_id,
    type,
    timestamp,
    sentAmount: sent > 0 ? sent : null,
    sentCurrency: sent > 0 ? "KAS" : null,
    receivedAmount: received > 0 ? received : null,
    receivedCurrency: received > 0 ? "KAS" : null,
    feeAmount: fee,
    feeCurrency: "KAS",
    transactionHash: tx.transaction_id,
    notes,
    tag: getTagForType(type),
    fiatPrice: kasPrice ?? undefined,
  };
}

/**
 * Process all transactions and return normalized list
 */
export function processTransactions(
  transactions: KaspaTransaction[],
  walletAddress: string,
  kasPrice: number | null
): NormalizedTransaction[] {
  const normalized: NormalizedTransaction[] = [];

  for (const tx of transactions) {
    const result = normalizeTransaction(tx, walletAddress, kasPrice);
    if (result) {
      normalized.push(result);
    }
  }

  // Sort by timestamp ascending
  normalized.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return normalized;
}
