import type {
  NormalizedTransaction,
  TransactionType,
  AwakenTag,
} from "@/lib/types";
import type {
  RawTransfer,
  RawDelegationEvent,
  RawStakeBalanceHistory,
} from "./types";
import { raoToTao } from "./utils";

function getTagForType(type: TransactionType): AwakenTag {
  switch (type) {
    case "transfer_sent":
      return "payment";
    case "transfer_received":
      return "receive";
    case "stake":
      return "staking_deposit";
    case "unstake":
      return "unstaking_withdraw";
    case "emission_reward":
      return "claim_rewards";
    default:
      return "payment";
  }
}

export function normalizeTransfer(
  transfer: RawTransfer,
  walletAddress: string,
  priceMap: Map<string, number>
): NormalizedTransaction {
  const isSent = transfer.from.ss58.toLowerCase() === walletAddress.toLowerCase();
  const type: TransactionType = isSent ? "transfer_sent" : "transfer_received";
  const timestamp = new Date(transfer.timestamp);
  const dateKey = transfer.timestamp.split("T")[0];
  const fiatPrice = priceMap.get(dateKey);

  const amount = raoToTao(transfer.amount);
  const fee = raoToTao(transfer.fee);

  return {
    id: transfer.id,
    type,
    timestamp,
    sentAmount: isSent ? amount : null,
    sentCurrency: isSent ? "TAO" : null,
    receivedAmount: isSent ? null : amount,
    receivedCurrency: isSent ? null : "TAO",
    feeAmount: fee,
    feeCurrency: "TAO",
    transactionHash: transfer.transaction_hash,
    notes: isSent
      ? `Transfer to ${transfer.to.ss58.slice(0, 8)}...`
      : `Transfer from ${transfer.from.ss58.slice(0, 8)}...`,
    tag: getTagForType(type),
    fiatPrice,
  };
}

export function normalizeDelegationEvent(
  event: RawDelegationEvent,
  priceMap: Map<string, number>
): NormalizedTransaction {
  const type: TransactionType = event.action === "stake" ? "stake" : "unstake";
  const timestamp = new Date(event.timestamp);
  const dateKey = event.timestamp.split("T")[0];
  const fiatPrice = priceMap.get(dateKey);

  const amount = raoToTao(event.amount);
  const fee = event.fee ? raoToTao(event.fee) : 0;

  const isStake = event.action === "stake";

  return {
    id: event.id,
    type,
    timestamp,
    sentAmount: isStake ? amount : null,
    sentCurrency: isStake ? "TAO" : null,
    receivedAmount: isStake ? null : amount,
    receivedCurrency: isStake ? null : "TAO",
    feeAmount: fee,
    feeCurrency: "TAO",
    transactionHash: event.transaction_hash || "",
    notes: isStake
      ? `Stake to validator ${event.hotkey.ss58.slice(0, 8)}...`
      : `Unstake from validator ${event.hotkey.ss58.slice(0, 8)}...`,
    tag: getTagForType(type),
    fiatPrice,
  };
}

export function calculateEmissionRewards(
  stakeHistory: RawStakeBalanceHistory[],
  delegationEvents: RawDelegationEvent[],
  priceMap: Map<string, number>
): NormalizedTransaction[] {
  if (stakeHistory.length < 2) return [];

  const rewards: NormalizedTransaction[] = [];

  // Create a map of delegation events by date for netting out stake changes
  const delegationByDate = new Map<string, number>();
  for (const event of delegationEvents) {
    const date = event.timestamp.split("T")[0];
    const amount = raoToTao(event.amount);
    const current = delegationByDate.get(date) || 0;
    // Positive for stake, negative for unstake
    delegationByDate.set(
      date,
      current + (event.action === "stake" ? amount : -amount)
    );
  }

  // Sort stake history by timestamp
  const sortedHistory = [...stakeHistory].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 1; i < sortedHistory.length; i++) {
    const prev = sortedHistory[i - 1];
    const curr = sortedHistory[i];

    const prevBalance = raoToTao(prev.balance_staked);
    const currBalance = raoToTao(curr.balance_staked);

    // Calculate gross change in stake
    const grossChange = currBalance - prevBalance;

    // Get net delegation activity for this period
    const date = curr.timestamp.split("T")[0];
    const delegationNet = delegationByDate.get(date) || 0;

    // Emission reward = change in balance - delegation activity
    // If you staked 10 TAO and balance went up by 12, you earned 2 in rewards
    const rewardAmount = grossChange - delegationNet;

    // Only record positive rewards (emissions)
    if (rewardAmount > 0.0001) {
      const fiatPrice = priceMap.get(date);

      rewards.push({
        id: `reward-${curr.block_number}`,
        type: "emission_reward",
        timestamp: new Date(curr.timestamp),
        sentAmount: null,
        sentCurrency: null,
        receivedAmount: rewardAmount,
        receivedCurrency: "TAO",
        feeAmount: 0,
        feeCurrency: "TAO",
        transactionHash: "",
        notes: `Staking emission reward (block ${curr.block_number})`,
        tag: "claim_rewards",
        fiatPrice,
      });
    }
  }

  return rewards;
}

export function mergeAndSortTransactions(
  transfers: NormalizedTransaction[],
  delegations: NormalizedTransaction[],
  rewards: NormalizedTransaction[]
): NormalizedTransaction[] {
  const all = [...transfers, ...delegations, ...rewards];

  // Sort by timestamp ascending
  all.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Remove potential duplicates by id
  const seen = new Set<string>();
  return all.filter((tx) => {
    if (seen.has(tx.id)) return false;
    seen.add(tx.id);
    return true;
  });
}
