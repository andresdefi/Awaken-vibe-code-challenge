// Hedera Transaction Normalizer

import type {
  NormalizedTransaction,
  TransactionType,
  AwakenTag,
} from "@/lib/types";
import {
  type HederaTransaction,
  type HederaTokenInfo,
  TINYBARS_PER_HBAR,
} from "./types";
import {
  parseConsensusTimestamp,
  fetchTokenInfoBatch,
  fetchHbarPrice,
  getUniqueDates,
} from "./api";

// Convert tinybars to HBAR
function tinybarsToHbar(tinybars: number): number {
  return tinybars / TINYBARS_PER_HBAR;
}

// Map transaction type to Awaken tag
function getTagForType(type: TransactionType): AwakenTag {
  switch (type) {
    case "transfer_sent":
      return "payment";
    case "transfer_received":
      return "receive";
    case "emission_reward":
      return "claim_rewards";
    case "token_sent":
      return "payment";
    case "token_received":
      return "receive";
    case "nft_sent":
      return "gift_sent";
    case "nft_received":
      return "receive";
    default:
      return "payment";
  }
}

// Determine transaction type based on transfers
function determineType(
  tx: HederaTransaction,
  accountId: string,
  isStakingReward: boolean,
  netAmount: number
): TransactionType {
  if (isStakingReward) {
    return "emission_reward";
  }

  if (netAmount > 0) {
    return "transfer_received";
  } else if (netAmount < 0) {
    return "transfer_sent";
  }

  return "transfer_sent";
}

// Process a single transaction
function processTransaction(
  tx: HederaTransaction,
  accountId: string,
  tokenInfoMap: Map<string, HederaTokenInfo>,
  hbarPrices: Map<string, number>
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  const timestamp = parseConsensusTimestamp(tx.consensus_timestamp);
  const dateStr = timestamp.toISOString().split("T")[0];
  const hbarPrice = hbarPrices.get(dateStr);

  // Calculate fee
  const fee = tx.charged_tx_fee > 0 ? tinybarsToHbar(tx.charged_tx_fee) : 0;

  // Process staking rewards first
  if (tx.staking_reward_transfers && tx.staking_reward_transfers.length > 0) {
    const rewardTransfer = tx.staking_reward_transfers.find(
      t => t.account === accountId
    );

    if (rewardTransfer && rewardTransfer.amount > 0) {
      const amount = tinybarsToHbar(rewardTransfer.amount);
      results.push({
        id: `reward-${tx.consensus_timestamp}`,
        type: "emission_reward",
        timestamp,
        sentAmount: null,
        sentCurrency: null,
        receivedAmount: amount,
        receivedCurrency: "HBAR",
        feeAmount: 0,
        feeCurrency: "HBAR",
        transactionHash: tx.transaction_hash,
        notes: "Staking reward",
        tag: "claim_rewards",
        fiatPrice: hbarPrice,
      });
    }
  }

  // Process HBAR transfers
  const hbarTransfers = tx.transfers.filter(t => t.account === accountId);

  if (hbarTransfers.length > 0) {
    const netAmount = hbarTransfers.reduce((sum, t) => sum + t.amount, 0);

    // Skip if we already processed this as a staking reward
    const isStakingReward = tx.staking_reward_transfers?.some(
      t => t.account === accountId && t.amount > 0
    );

    if (isStakingReward && results.length > 0) {
      // Already processed as staking reward
    } else if (netAmount !== 0) {
      const amount = tinybarsToHbar(Math.abs(netAmount));
      const type = determineType(tx, accountId, false, netAmount);
      const memo = tx.memo_base64
        ? Buffer.from(tx.memo_base64, "base64").toString("utf8")
        : "";

      if (netAmount > 0) {
        // Received HBAR
        results.push({
          id: `hbar-${tx.consensus_timestamp}`,
          type: "transfer_received",
          timestamp,
          sentAmount: null,
          sentCurrency: null,
          receivedAmount: amount,
          receivedCurrency: "HBAR",
          feeAmount: 0,
          feeCurrency: "HBAR",
          transactionHash: tx.transaction_hash,
          notes: memo || "Received HBAR",
          tag: "receive",
          fiatPrice: hbarPrice,
        });
      } else {
        // Sent HBAR (excluding fee)
        const sentAmount = amount - fee;

        if (sentAmount > 0) {
          results.push({
            id: `hbar-${tx.consensus_timestamp}`,
            type: "transfer_sent",
            timestamp,
            sentAmount: sentAmount,
            sentCurrency: "HBAR",
            receivedAmount: null,
            receivedCurrency: null,
            feeAmount: fee,
            feeCurrency: "HBAR",
            transactionHash: tx.transaction_hash,
            notes: memo || "Sent HBAR",
            tag: "payment",
            fiatPrice: hbarPrice,
          });
        }
      }
    }
  }

  // Process token transfers (HTS tokens)
  if (tx.token_transfers && tx.token_transfers.length > 0) {
    const accountTokenTransfers = tx.token_transfers.filter(
      t => t.account === accountId
    );

    for (const transfer of accountTokenTransfers) {
      const tokenInfo = tokenInfoMap.get(transfer.token_id);
      const symbol = tokenInfo?.symbol || transfer.token_id;
      const decimals = parseInt(tokenInfo?.decimals || "0");
      const amount = transfer.amount / Math.pow(10, decimals);

      if (transfer.amount > 0) {
        // Received token
        results.push({
          id: `token-${tx.consensus_timestamp}-${transfer.token_id}`,
          type: "token_received",
          timestamp,
          sentAmount: null,
          sentCurrency: null,
          receivedAmount: amount,
          receivedCurrency: symbol,
          feeAmount: 0,
          feeCurrency: "HBAR",
          transactionHash: tx.transaction_hash,
          notes: `Received ${symbol}`,
          tag: "receive",
          fiatPrice: hbarPrice,
        });
      } else {
        // Sent token
        results.push({
          id: `token-${tx.consensus_timestamp}-${transfer.token_id}`,
          type: "token_sent",
          timestamp,
          sentAmount: Math.abs(amount),
          sentCurrency: symbol,
          receivedAmount: null,
          receivedCurrency: null,
          feeAmount: 0,
          feeCurrency: "HBAR",
          transactionHash: tx.transaction_hash,
          notes: `Sent ${symbol}`,
          tag: "payment",
          fiatPrice: hbarPrice,
        });
      }
    }
  }

  // Process NFT transfers
  if (tx.nft_transfers && tx.nft_transfers.length > 0) {
    for (const nft of tx.nft_transfers) {
      const tokenInfo = tokenInfoMap.get(nft.token_id);
      const nftName = tokenInfo?.name || nft.token_id;

      if (nft.receiver_account_id === accountId) {
        // Received NFT
        results.push({
          id: `nft-${tx.consensus_timestamp}-${nft.token_id}-${nft.serial_number}`,
          type: "nft_received",
          timestamp,
          sentAmount: null,
          sentCurrency: null,
          receivedAmount: 1,
          receivedCurrency: `${nftName} #${nft.serial_number}`,
          feeAmount: 0,
          feeCurrency: "HBAR",
          transactionHash: tx.transaction_hash,
          notes: `Received NFT: ${nftName} #${nft.serial_number}`,
          tag: "receive",
          fiatPrice: hbarPrice,
        });
      } else if (nft.sender_account_id === accountId) {
        // Sent NFT
        results.push({
          id: `nft-${tx.consensus_timestamp}-${nft.token_id}-${nft.serial_number}`,
          type: "nft_sent",
          timestamp,
          sentAmount: 1,
          sentCurrency: `${nftName} #${nft.serial_number}`,
          receivedAmount: null,
          receivedCurrency: null,
          feeAmount: 0,
          feeCurrency: "HBAR",
          transactionHash: tx.transaction_hash,
          notes: `Sent NFT: ${nftName} #${nft.serial_number}`,
          tag: "gift_sent",
          fiatPrice: hbarPrice,
        });
      }
    }
  }

  return results;
}

// Main function to normalize all transactions
export async function normalizeHederaTransactions(
  transactions: HederaTransaction[],
  accountId: string,
  onProgress?: (message: string) => void
): Promise<NormalizedTransaction[]> {
  if (transactions.length === 0) {
    return [];
  }

  onProgress?.("Fetching token metadata...");

  // Collect all unique token IDs
  const tokenIds = new Set<string>();
  for (const tx of transactions) {
    for (const transfer of tx.token_transfers || []) {
      tokenIds.add(transfer.token_id);
    }
    for (const nft of tx.nft_transfers || []) {
      tokenIds.add(nft.token_id);
    }
  }

  // Fetch token info
  const tokenInfoMap = await fetchTokenInfoBatch(Array.from(tokenIds));

  onProgress?.("Fetching historical prices...");

  // Fetch HBAR prices for unique dates
  const uniqueDates = getUniqueDates(transactions);
  const hbarPrices = new Map<string, number>();

  // Limit price fetches to avoid rate limiting
  const datesToFetch = uniqueDates.slice(0, 30); // Max 30 unique dates

  for (const dateStr of datesToFetch) {
    const [year, month, day] = dateStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const price = await fetchHbarPrice(date);
    if (price !== null) {
      hbarPrices.set(dateStr, price);
    }
  }

  onProgress?.("Processing transactions...");

  // Process all transactions
  const normalizedTxs: NormalizedTransaction[] = [];

  for (const tx of transactions) {
    const processed = processTransaction(tx, accountId, tokenInfoMap, hbarPrices);
    normalizedTxs.push(...processed);
  }

  // Sort by timestamp descending
  normalizedTxs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return normalizedTxs;
}

// Calculate summary statistics
export function calculateSummary(transactions: NormalizedTransaction[]) {
  let totalReceived = 0;
  let totalSent = 0;
  let totalFees = 0;
  let stakingRewards = 0;
  const assets = new Set<string>();

  for (const tx of transactions) {
    if (tx.receivedCurrency) {
      assets.add(tx.receivedCurrency);
      if (tx.receivedCurrency === "HBAR" && tx.receivedAmount) {
        totalReceived += tx.receivedAmount;
        if (tx.tag === "claim_rewards") {
          stakingRewards += tx.receivedAmount;
        }
      }
    }

    if (tx.sentCurrency) {
      assets.add(tx.sentCurrency);
      if (tx.sentCurrency === "HBAR" && tx.sentAmount) {
        totalSent += tx.sentAmount;
      }
    }

    if (tx.feeAmount && tx.feeCurrency === "HBAR") {
      totalFees += tx.feeAmount;
    }
  }

  return {
    totalTransactions: transactions.length,
    totalReceived,
    totalSent,
    totalFees,
    stakingRewards,
    assets: Array.from(assets),
  };
}
