// MultiversX transaction normalization

import type { NormalizedTransaction, TransactionType, AwakenTag } from "@/lib/types";
import type { MultiversXTransfer, MultiversXDelegation } from "./types";
import { toEgld, normalizeAddress, parseFunctionFromData } from "./utils";

// Known staking/delegation function names
const STAKING_FUNCTIONS = [
  "delegate",
  "stake",
  "reDelegateRewards",
  "unDelegate",
  "unStake",
  "withdraw",
  "claimRewards",
];

function getTagForType(type: TransactionType): AwakenTag {
  switch (type) {
    case "transfer_sent":
    case "token_sent":
      return "payment";
    case "transfer_received":
    case "token_received":
    case "airdrop":
      return "receive";
    case "stake":
    case "bond":
    case "nominate":
      return "staking_deposit";
    case "unstake":
    case "unbond":
      return "unstaking_withdraw";
    case "emission_reward":
      return "claim_rewards";
    default:
      return "payment";
  }
}

/**
 * Determine transaction type from MultiversX transfer
 */
function determineTransactionType(
  transfer: MultiversXTransfer,
  walletAddress: string
): { type: TransactionType; notes: string } {
  const normalizedWallet = normalizeAddress(walletAddress);
  const sender = normalizeAddress(transfer.sender);
  const receiver = normalizeAddress(transfer.receiver);
  const isSender = sender === normalizedWallet;
  const isReceiver = receiver === normalizedWallet;

  // Check action category for special handling
  const actionCategory = transfer.action?.category?.toLowerCase();
  const actionName = transfer.action?.name?.toLowerCase();
  const functionName = transfer.function?.toLowerCase() || parseFunctionFromData(transfer.function)?.toLowerCase();

  // Check for staking/delegation
  if (actionCategory === "stake" || STAKING_FUNCTIONS.some(fn => functionName?.includes(fn))) {
    if (functionName?.includes("delegate") && !functionName?.includes("undelegate")) {
      return { type: "stake", notes: "Delegation to staking provider" };
    }
    if (functionName?.includes("undelegate") || functionName?.includes("unstake")) {
      return { type: "unstake", notes: "Undelegation from staking provider" };
    }
    if (functionName?.includes("claimrewards") || functionName?.includes("claim")) {
      return { type: "emission_reward", notes: "Staking rewards claimed" };
    }
    if (functionName?.includes("withdraw")) {
      return { type: "unstake", notes: "Withdrawal from staking" };
    }
    if (functionName?.includes("stake") && !functionName?.includes("unstake")) {
      return { type: "stake", notes: "Staked EGLD" };
    }
    if (functionName?.includes("redelegate")) {
      return { type: "stake", notes: "Rewards re-delegated" };
    }
  }

  // Check for smart contract results that are rewards
  if (transfer.type === "SmartContractResult" && isReceiver && !isSender) {
    // Check if this is from a staking provider
    const isFromStakingProvider = transfer.sender.startsWith("erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqylllslmq4y6");
    if (isFromStakingProvider) {
      return { type: "emission_reward", notes: "Staking reward received" };
    }
  }

  // Check for token transfers (ESDT)
  if (transfer.token || transfer.tokenIdentifier) {
    const token = transfer.token || transfer.tokenIdentifier || "ESDT";
    if (isSender && !isReceiver) {
      return { type: "token_sent", notes: `${token} token transfer` };
    } else if (isReceiver && !isSender) {
      return { type: "token_received", notes: `${token} token received` };
    }
  }

  // Standard EGLD transfers
  if (isSender && !isReceiver) {
    const receiverDisplay = transfer.receiver.slice(0, 16);
    return { type: "transfer_sent", notes: `Transfer to ${receiverDisplay}...` };
  } else if (isReceiver && !isSender) {
    const senderDisplay = transfer.sender.slice(0, 16);
    return { type: "transfer_received", notes: `Transfer from ${senderDisplay}...` };
  }

  // Self-transfer (e.g., smart contract interaction)
  if (isSender && isReceiver) {
    const description = transfer.action?.description || actionName || "Self-transfer";
    return { type: "transfer_sent", notes: description };
  }

  return { type: "transfer_sent", notes: "Transaction" };
}

/**
 * Normalize a MultiversX transfer to Awaken format
 */
export function normalizeTransaction(
  transfer: MultiversXTransfer,
  walletAddress: string,
  egldPrice: number | null
): NormalizedTransaction | null {
  // Skip failed transactions
  if (transfer.status !== "success") {
    return null;
  }

  const normalizedWallet = normalizeAddress(walletAddress);
  const sender = normalizeAddress(transfer.sender);
  const receiver = normalizeAddress(transfer.receiver);
  const isSender = sender === normalizedWallet;
  const isReceiver = receiver === normalizedWallet;

  // Skip if wallet is not involved
  if (!isSender && !isReceiver) {
    return null;
  }

  const { type, notes } = determineTransactionType(transfer, walletAddress);

  // Handle amounts
  let sentAmount: number | null = null;
  let sentCurrency: string | null = null;
  let receivedAmount: number | null = null;
  let receivedCurrency: string | null = null;

  // Check for token transfer
  const isTokenTransfer = transfer.token || transfer.tokenIdentifier;
  const tokenName = transfer.token || transfer.tokenIdentifier;
  const tokenValue = transfer.tokenValue || transfer.value;

  if (isTokenTransfer && tokenName) {
    // ESDT token transfer
    // Extract token ticker from identifier (e.g., "USDC-c76f1d" -> "USDC")
    const tokenTicker = tokenName.split("-")[0];
    const amount = toEgld(tokenValue); // Most tokens use 18 decimals too

    if (isSender && !isReceiver) {
      sentAmount = amount;
      sentCurrency = tokenTicker;
    } else if (isReceiver && !isSender) {
      receivedAmount = amount;
      receivedCurrency = tokenTicker;
    }
  } else {
    // Native EGLD transfer
    const egldAmount = toEgld(transfer.value);

    // For staking transactions, handle differently
    if (type === "stake" || type === "bond") {
      sentAmount = egldAmount > 0 ? egldAmount : null;
      sentCurrency = egldAmount > 0 ? "EGLD" : null;
    } else if (type === "unstake" || type === "unbond" || type === "emission_reward") {
      receivedAmount = egldAmount > 0 ? egldAmount : null;
      receivedCurrency = egldAmount > 0 ? "EGLD" : null;
    } else if (isSender && !isReceiver) {
      sentAmount = egldAmount > 0 ? egldAmount : null;
      sentCurrency = egldAmount > 0 ? "EGLD" : null;
    } else if (isReceiver && !isSender) {
      receivedAmount = egldAmount > 0 ? egldAmount : null;
      receivedCurrency = egldAmount > 0 ? "EGLD" : null;
    }
  }

  // Skip if no value moved
  if (!sentAmount && !receivedAmount) {
    // Unless it's a smart contract interaction
    if (!transfer.function && !transfer.action) {
      return null;
    }
  }

  // Fee handling - only the sender pays fees
  const feeAmount = isSender && transfer.fee ? toEgld(transfer.fee) : 0;

  // Timestamp is in seconds
  const timestamp = new Date(transfer.timestamp * 1000);

  return {
    id: `${transfer.txHash}-${transfer.timestamp}`,
    type,
    timestamp,
    sentAmount,
    sentCurrency,
    receivedAmount,
    receivedCurrency,
    feeAmount,
    feeCurrency: "EGLD",
    transactionHash: transfer.txHash,
    notes,
    tag: getTagForType(type),
    fiatPrice: egldPrice ?? undefined,
  };
}

/**
 * Create transactions from delegation claimable rewards
 * These may not show as transfers but are important for tax purposes
 */
export function createDelegationRewardTransactions(
  delegations: MultiversXDelegation[],
  egldPrice: number | null
): NormalizedTransaction[] {
  const rewards: NormalizedTransaction[] = [];

  for (const delegation of delegations) {
    const claimable = toEgld(delegation.claimableRewards);
    if (claimable > 0) {
      rewards.push({
        id: `delegation-reward-${delegation.contract}`,
        type: "emission_reward",
        timestamp: new Date(), // Current time since these are pending
        sentAmount: null,
        sentCurrency: null,
        receivedAmount: claimable,
        receivedCurrency: "EGLD",
        feeAmount: 0,
        feeCurrency: "EGLD",
        transactionHash: delegation.contract,
        notes: `Pending staking reward from ${delegation.address.slice(0, 16)}...`,
        tag: "claim_rewards",
        fiatPrice: egldPrice ?? undefined,
        isAmbiguous: true,
        ambiguousReasons: ["Pending reward - not yet claimed"],
      });
    }
  }

  return rewards;
}

/**
 * Process all transfers and return normalized list
 */
export function processTransactions(
  transfers: MultiversXTransfer[],
  walletAddress: string,
  egldPrice: number | null,
  includePendingRewards: boolean = false,
  delegations: MultiversXDelegation[] = []
): NormalizedTransaction[] {
  const normalized: NormalizedTransaction[] = [];
  const seenHashes = new Set<string>();

  for (const transfer of transfers) {
    // Deduplicate by txHash + type to avoid counting same tx twice
    const key = `${transfer.txHash}-${transfer.type}`;
    if (seenHashes.has(key)) {
      continue;
    }
    seenHashes.add(key);

    const result = normalizeTransaction(transfer, walletAddress, egldPrice);
    if (result) {
      normalized.push(result);
    }
  }

  // Optionally include pending delegation rewards
  if (includePendingRewards && delegations.length > 0) {
    const rewardTxs = createDelegationRewardTransactions(delegations, egldPrice);
    normalized.push(...rewardTxs);
  }

  // Sort by timestamp ascending
  normalized.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return normalized;
}
