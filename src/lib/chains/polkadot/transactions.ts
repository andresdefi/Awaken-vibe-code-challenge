import type {
  NormalizedTransaction,
  TransactionType,
  AwakenTag,
} from "@/lib/types";
import type {
  RawTransfer,
  RawRewardSlash,
  RawExtrinsic,
} from "./types";
import { planckToDot } from "./utils";

function getTagForType(type: TransactionType): AwakenTag {
  switch (type) {
    case "transfer_sent":
      return "payment";
    case "transfer_received":
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
    case "slash":
      return "lost";
    default:
      return "payment";
  }
}

export function normalizeTransfer(
  transfer: RawTransfer,
  walletAddress: string,
  priceMap: Map<string, number>
): NormalizedTransaction {
  const isSent = transfer.from.toLowerCase() === walletAddress.toLowerCase();
  const type: TransactionType = isSent ? "transfer_sent" : "transfer_received";
  const timestamp = new Date(transfer.block_timestamp * 1000);
  const dateKey = timestamp.toISOString().split("T")[0];
  const fiatPrice = priceMap.get(dateKey);

  // Use amount_v2 if available (more precise), fallback to amount
  const amountStr = transfer.amount_v2 || transfer.amount;
  const amount = planckToDot(amountStr);
  const fee = transfer.fee ? planckToDot(transfer.fee) : 0;

  return {
    id: `transfer-${transfer.extrinsic_index}`,
    type,
    timestamp,
    sentAmount: isSent ? amount : null,
    sentCurrency: isSent ? "DOT" : null,
    receivedAmount: isSent ? null : amount,
    receivedCurrency: isSent ? null : "DOT",
    feeAmount: isSent ? fee : 0, // Only sender pays fee
    feeCurrency: "DOT",
    transactionHash: transfer.hash,
    notes: isSent
      ? `Transfer to ${transfer.to.slice(0, 8)}...`
      : `Transfer from ${transfer.from.slice(0, 8)}...`,
    tag: getTagForType(type),
    fiatPrice,
  };
}

export function normalizeReward(
  reward: RawRewardSlash,
  priceMap: Map<string, number>
): NormalizedTransaction {
  const timestamp = new Date(reward.block_timestamp * 1000);
  const dateKey = timestamp.toISOString().split("T")[0];
  const fiatPrice = priceMap.get(dateKey);
  const amount = planckToDot(reward.amount);

  return {
    id: `reward-${reward.event_index}`,
    type: "emission_reward",
    timestamp,
    sentAmount: null,
    sentCurrency: null,
    receivedAmount: amount,
    receivedCurrency: "DOT",
    feeAmount: 0,
    feeCurrency: "DOT",
    transactionHash: reward.extrinsic_hash || "",
    notes: `Staking reward (${reward.event_method})`,
    tag: "claim_rewards",
    fiatPrice,
  };
}

export function normalizeSlash(
  slash: RawRewardSlash,
  priceMap: Map<string, number>
): NormalizedTransaction {
  const timestamp = new Date(slash.block_timestamp * 1000);
  const dateKey = timestamp.toISOString().split("T")[0];
  const fiatPrice = priceMap.get(dateKey);
  const amount = planckToDot(slash.amount);

  return {
    id: `slash-${slash.event_index}`,
    type: "slash",
    timestamp,
    sentAmount: amount,
    sentCurrency: "DOT",
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: 0,
    feeCurrency: "DOT",
    transactionHash: slash.extrinsic_hash || "",
    notes: `Slashing penalty (${slash.event_method})`,
    tag: "lost",
    fiatPrice,
  };
}

export function normalizeStakingExtrinsic(
  extrinsic: RawExtrinsic,
  priceMap: Map<string, number>
): NormalizedTransaction | null {
  const timestamp = new Date(extrinsic.block_timestamp * 1000);
  const dateKey = timestamp.toISOString().split("T")[0];
  const fiatPrice = priceMap.get(dateKey);
  const fee = extrinsic.fee ? planckToDot(extrinsic.fee) : 0;

  // Parse the params to get the amount
  let amount = 0;
  try {
    const params = JSON.parse(extrinsic.params || "[]");
    const valueParam = params.find((p: { name: string; value: string }) =>
      p.name === "value" || p.name === "amount" || p.name === "max_additional"
    );
    if (valueParam) {
      amount = planckToDot(valueParam.value);
    }
  } catch {
    // Params parsing failed, amount stays 0
  }

  const func = extrinsic.call_module_function.toLowerCase();

  // Bond = initial stake
  if (func === "bond" || func === "bond_extra") {
    return {
      id: `bond-${extrinsic.extrinsic_index}`,
      type: "bond",
      timestamp,
      sentAmount: amount,
      sentCurrency: "DOT",
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: fee,
      feeCurrency: "DOT",
      transactionHash: extrinsic.extrinsic_hash,
      notes: func === "bond" ? "Initial staking bond" : "Add to staking bond",
      tag: "staking_deposit",
      fiatPrice,
    };
  }

  // Unbond = start unstaking (28 day period)
  if (func === "unbond") {
    return {
      id: `unbond-${extrinsic.extrinsic_index}`,
      type: "unbond",
      timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: amount,
      receivedCurrency: "DOT",
      feeAmount: fee,
      feeCurrency: "DOT",
      transactionHash: extrinsic.extrinsic_hash,
      notes: "Unbonding started (28 day wait)",
      tag: "unstaking_withdraw",
      fiatPrice,
    };
  }

  // Withdraw unbonded = actually receive the DOT back
  if (func === "withdraw_unbonded") {
    return {
      id: `withdraw-${extrinsic.extrinsic_index}`,
      type: "unstake",
      timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: amount,
      receivedCurrency: "DOT",
      feeAmount: fee,
      feeCurrency: "DOT",
      transactionHash: extrinsic.extrinsic_hash,
      notes: "Withdrew unbonded DOT",
      tag: "unstaking_withdraw",
      fiatPrice,
    };
  }

  // Rebond = cancel unbonding and restake
  if (func === "rebond") {
    return {
      id: `rebond-${extrinsic.extrinsic_index}`,
      type: "stake",
      timestamp,
      sentAmount: amount,
      sentCurrency: "DOT",
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: fee,
      feeCurrency: "DOT",
      transactionHash: extrinsic.extrinsic_hash,
      notes: "Rebonded (cancelled unstaking)",
      tag: "staking_deposit",
      fiatPrice,
    };
  }

  // Skip nominate and other non-value-changing operations
  return null;
}

export function mergeAndSortTransactions(
  ...transactionArrays: NormalizedTransaction[][]
): NormalizedTransaction[] {
  const all = transactionArrays.flat();

  // Sort by timestamp ascending
  all.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Remove duplicates by id
  const seen = new Set<string>();
  return all.filter((tx) => {
    if (seen.has(tx.id)) return false;
    seen.add(tx.id);
    return true;
  });
}
