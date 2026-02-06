// Radix transaction normalization to Awaken CSV format

import type { NormalizedTransaction, TransactionType, AwakenTag } from "@/lib/types";
import type { RadixTransaction, RadixTransactionBalanceChange, RadixManifestClass } from "./types";
import { toXrd, normalizeAddress, extractTokenSymbol, parseTimestamp } from "./utils";
import { XRD_RESOURCE_ADDRESS } from "./types";

/**
 * Map manifest class to Awaken tag for tax purposes
 */
function getTagForManifestClass(manifestClasses: RadixManifestClass[] | undefined): {
  type: TransactionType;
  tag: AwakenTag;
  notes: string;
} {
  if (!manifestClasses || manifestClasses.length === 0) {
    return { type: "transfer_sent", tag: "payment", notes: "Transaction" };
  }

  // Get the most specific class (last one is usually most specific)
  const primaryClass = manifestClasses[manifestClasses.length - 1]?.class || manifestClasses[0]?.class;

  switch (primaryClass) {
    case "ValidatorStake":
      return { type: "stake", tag: "staking_deposit", notes: "Staked XRD to validator" };

    case "ValidatorUnstake":
      return { type: "unstake", tag: "unstaking_withdraw", notes: "Unstaked XRD from validator" };

    case "ValidatorClaimXrd":
      return { type: "emission_reward", tag: "claim_rewards", notes: "Claimed staking rewards" };

    case "PoolContribution":
      return { type: "liquidity_add", tag: "trade", notes: "Added liquidity to pool" };

    case "PoolRedemption":
      return { type: "liquidity_remove", tag: "trade", notes: "Removed liquidity from pool" };

    case "Transfer":
      return { type: "transfer_sent", tag: "payment", notes: "Transfer" };

    case "AccountDepositSettingsUpdate":
    case "AccountResourcePreferenceUpdate":
    case "AccountAuthorizedDepositorUpdate":
      return { type: "transfer_sent", tag: "payment", notes: "Account settings update" };

    case "General":
    default:
      return { type: "transfer_sent", tag: "payment", notes: "Transaction" };
  }
}

/**
 * Determine transaction direction based on balance changes
 */
function analyzeBalanceChanges(
  balanceChanges: RadixTransactionBalanceChange | undefined,
  walletAddress: string
): {
  sentAmount: number | null;
  sentCurrency: string | null;
  receivedAmount: number | null;
  receivedCurrency: string | null;
  feeAmount: number;
  feeCurrency: string;
  isSender: boolean;
  isReceiver: boolean;
} {
  let sentAmount: number | null = null;
  let sentCurrency: string | null = null;
  let receivedAmount: number | null = null;
  let receivedCurrency: string | null = null;
  let feeAmount = 0;
  const feeCurrency = "XRD";

  const normalizedWallet = normalizeAddress(walletAddress);

  if (!balanceChanges) {
    return {
      sentAmount,
      sentCurrency,
      receivedAmount,
      receivedCurrency,
      feeAmount,
      feeCurrency,
      isSender: false,
      isReceiver: false,
    };
  }

  // Check if this balance change is for our wallet
  const isForWallet = normalizeAddress(balanceChanges.entity_address) === normalizedWallet;

  if (!isForWallet) {
    return {
      sentAmount,
      sentCurrency,
      receivedAmount,
      receivedCurrency,
      feeAmount,
      feeCurrency,
      isSender: false,
      isReceiver: false,
    };
  }

  // Process fee balance changes
  if (balanceChanges.fee_balance_change) {
    const feeChange = toXrd(balanceChanges.fee_balance_change.balance_change);
    if (feeChange < 0) {
      feeAmount = Math.abs(feeChange);
    }
  }

  if (balanceChanges.fee_balance_changes) {
    for (const change of balanceChanges.fee_balance_changes) {
      const amount = toXrd(change.balance_change);
      if (amount < 0) {
        feeAmount += Math.abs(amount);
      }
    }
  }

  // Process non-fee balance changes
  if (balanceChanges.non_fee_balance_changes) {
    for (const change of balanceChanges.non_fee_balance_changes) {
      const amount = toXrd(change.balance_change);
      const isXrd = change.resource_address === XRD_RESOURCE_ADDRESS;
      const currency = isXrd ? "XRD" : extractTokenSymbol(change.resource_address);

      if (amount > 0) {
        // Received
        if (!receivedAmount || amount > receivedAmount) {
          receivedAmount = amount;
          receivedCurrency = currency;
        }
      } else if (amount < 0) {
        // Sent
        const absAmount = Math.abs(amount);
        if (!sentAmount || absAmount > sentAmount) {
          sentAmount = absAmount;
          sentCurrency = currency;
        }
      }
    }
  }

  return {
    sentAmount,
    sentCurrency,
    receivedAmount,
    receivedCurrency,
    feeAmount,
    feeCurrency,
    isSender: sentAmount !== null || feeAmount > 0,
    isReceiver: receivedAmount !== null,
  };
}

/**
 * Normalize a Radix transaction to Awaken format
 */
export function normalizeTransaction(
  tx: RadixTransaction,
  walletAddress: string,
  xrdPrice: number | null
): NormalizedTransaction | null {
  // Skip failed transactions
  if (tx.transaction_status !== "CommittedSuccess") {
    return null;
  }

  // Analyze balance changes
  const balanceAnalysis = analyzeBalanceChanges(tx.balance_changes, walletAddress);

  // Skip if wallet is not involved
  if (!balanceAnalysis.isSender && !balanceAnalysis.isReceiver) {
    return null;
  }

  // Get transaction type from manifest class
  let { type, tag, notes } = getTagForManifestClass(tx.manifest_classes);

  // Refine type based on actual balance changes
  if (balanceAnalysis.receivedAmount && !balanceAnalysis.sentAmount) {
    // Pure receive
    if (type === "transfer_sent") {
      type = "transfer_received";
      tag = "receive";
      notes = "Received";
    }
  } else if (balanceAnalysis.sentAmount && !balanceAnalysis.receivedAmount) {
    // Pure send
    if (type === "transfer_received") {
      type = "transfer_sent";
      tag = "payment";
      notes = "Transfer";
    }
  } else if (balanceAnalysis.sentAmount && balanceAnalysis.receivedAmount) {
    // Swap or trade
    if (type === "transfer_sent" || type === "transfer_received") {
      type = "swap";
      tag = "trade";
      notes = `Swapped ${balanceAnalysis.sentCurrency} for ${balanceAnalysis.receivedCurrency}`;
    }
  }

  // Parse timestamp
  const timestamp = parseTimestamp(tx.round_timestamp);

  // Handle staking transactions specially
  if (type === "stake") {
    // Staking: we send XRD, don't receive anything back immediately
    return {
      id: tx.intent_hash,
      type,
      timestamp,
      sentAmount: balanceAnalysis.sentAmount,
      sentCurrency: balanceAnalysis.sentCurrency || "XRD",
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: balanceAnalysis.feeAmount,
      feeCurrency: "XRD",
      transactionHash: tx.intent_hash,
      notes,
      tag,
      fiatPrice: xrdPrice ?? undefined,
    };
  }

  if (type === "unstake") {
    // Unstaking: we receive XRD back
    return {
      id: tx.intent_hash,
      type,
      timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: balanceAnalysis.receivedAmount,
      receivedCurrency: balanceAnalysis.receivedCurrency || "XRD",
      feeAmount: balanceAnalysis.feeAmount,
      feeCurrency: "XRD",
      transactionHash: tx.intent_hash,
      notes,
      tag,
      fiatPrice: xrdPrice ?? undefined,
    };
  }

  if (type === "emission_reward") {
    // Staking rewards: taxable income, we receive XRD
    return {
      id: tx.intent_hash,
      type,
      timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: balanceAnalysis.receivedAmount,
      receivedCurrency: balanceAnalysis.receivedCurrency || "XRD",
      feeAmount: balanceAnalysis.feeAmount,
      feeCurrency: "XRD",
      transactionHash: tx.intent_hash,
      notes,
      tag,
      fiatPrice: xrdPrice ?? undefined,
    };
  }

  // Standard transaction
  return {
    id: tx.intent_hash,
    type,
    timestamp,
    sentAmount: balanceAnalysis.sentAmount,
    sentCurrency: balanceAnalysis.sentCurrency,
    receivedAmount: balanceAnalysis.receivedAmount,
    receivedCurrency: balanceAnalysis.receivedCurrency,
    feeAmount: balanceAnalysis.feeAmount,
    feeCurrency: "XRD",
    transactionHash: tx.intent_hash,
    notes,
    tag,
    fiatPrice: xrdPrice ?? undefined,
  };
}

/**
 * Process all transactions and return normalized list
 */
export function processTransactions(
  transactions: RadixTransaction[],
  walletAddress: string,
  xrdPrice: number | null
): NormalizedTransaction[] {
  const normalized: NormalizedTransaction[] = [];
  const seenHashes = new Set<string>();

  for (const tx of transactions) {
    // Deduplicate by intent hash
    if (seenHashes.has(tx.intent_hash)) {
      continue;
    }
    seenHashes.add(tx.intent_hash);

    const result = normalizeTransaction(tx, walletAddress, xrdPrice);
    if (result) {
      normalized.push(result);
    }
  }

  // Sort by timestamp ascending (for Awaken import)
  normalized.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return normalized;
}
