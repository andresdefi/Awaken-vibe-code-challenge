import type {
  NormalizedTransaction,
  TransactionType,
  AwakenTag,
} from "@/lib/types";
import type {
  ProcessedInjTx,
  TxMessage,
  MsgSend,
  MsgTransfer,
  MsgDelegate,
  MsgUndelegate,
  MsgBeginRedelegate,
  MsgWithdrawDelegatorReward,
  Coin,
} from "./types";
import {
  denomAmountToStandard,
  getSymbolFromDenom,
  INJECTIVE_UNBONDING_DAYS,
} from "./utils";
import { extractTokenMovements, extractStakingRewards } from "./api";

function getTagForType(type: TransactionType): AwakenTag {
  switch (type) {
    case "transfer_sent":
      return "payment";
    case "transfer_received":
      return "receive";
    case "stake":
    case "bond":
      return "staking_deposit";
    case "unstake":
    case "unbond":
      return "unstaking_withdraw";
    case "emission_reward":
      return "claim_rewards";
    case "swap":
      return "trade";
    default:
      return "payment";
  }
}

/**
 * Normalizes a processed transaction into NormalizedTransaction(s)
 */
export function normalizeTransaction(
  tx: ProcessedInjTx,
  walletAddress: string,
  priceMap: Map<string, number>
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  const dateKey = tx.timestamp.toISOString().split("T")[0];
  const fiatPrice = priceMap.get(dateKey);

  // Calculate fee (usually in inj)
  let totalFee = 0;
  let feeCurrency = "INJ";
  for (const feeCoin of tx.fee) {
    if (feeCoin.denom === "inj") {
      totalFee += denomAmountToStandard(feeCoin.amount, "inj");
      feeCurrency = "INJ";
    }
  }

  // Process each message in the transaction
  for (let i = 0; i < tx.messages.length; i++) {
    const msg = tx.messages[i];
    const normalized = normalizeMessage(
      msg,
      tx,
      walletAddress,
      priceMap,
      i === 0 ? totalFee : 0, // Only first message gets fee
      feeCurrency,
      i
    );

    if (normalized) {
      results.push(...(Array.isArray(normalized) ? normalized : [normalized]));
    }
  }

  // If no messages were normalized but we have token movements, create from events
  if (results.length === 0 && tx.code === 0) {
    const eventBased = normalizeFromEvents(tx, walletAddress, priceMap, totalFee, feeCurrency);
    if (eventBased) {
      results.push(...eventBased);
    }
  }

  return results;
}

/**
 * Normalizes a single message
 */
function normalizeMessage(
  msg: TxMessage,
  tx: ProcessedInjTx,
  walletAddress: string,
  priceMap: Map<string, number>,
  fee: number,
  feeCurrency: string,
  msgIndex: number
): NormalizedTransaction | NormalizedTransaction[] | null {
  const msgType = msg["@type"];
  const dateKey = tx.timestamp.toISOString().split("T")[0];
  const fiatPrice = priceMap.get(dateKey);

  // Bank Send
  if (msgType === "/cosmos.bank.v1beta1.MsgSend") {
    return normalizeMsgSend(msg as unknown as MsgSend, tx, walletAddress, fiatPrice, fee, feeCurrency, msgIndex);
  }

  // IBC Transfer
  if (msgType === "/ibc.applications.transfer.v1.MsgTransfer") {
    return normalizeMsgTransfer(msg as unknown as MsgTransfer, tx, walletAddress, fiatPrice, fee, feeCurrency, msgIndex);
  }

  // Delegate (Stake)
  if (msgType === "/cosmos.staking.v1beta1.MsgDelegate") {
    return normalizeMsgDelegate(msg as unknown as MsgDelegate, tx, fiatPrice, fee, feeCurrency, msgIndex);
  }

  // Undelegate (Unstake)
  if (msgType === "/cosmos.staking.v1beta1.MsgUndelegate") {
    return normalizeMsgUndelegate(msg as unknown as MsgUndelegate, tx, fiatPrice, fee, feeCurrency, msgIndex);
  }

  // Redelegate
  if (msgType === "/cosmos.staking.v1beta1.MsgBeginRedelegate") {
    return normalizeMsgRedelegate(msg as unknown as MsgBeginRedelegate, tx, fiatPrice, fee, feeCurrency, msgIndex);
  }

  // Withdraw Rewards
  if (msgType === "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward") {
    return normalizeMsgWithdrawReward(msg as unknown as MsgWithdrawDelegatorReward, tx, walletAddress, fiatPrice, fee, feeCurrency, msgIndex);
  }

  // Exchange module messages (spot trading)
  if (msgType.includes("injective.exchange")) {
    return normalizeExchangeMessage(msg, tx, walletAddress, fiatPrice, fee, feeCurrency, msgIndex);
  }

  return null;
}

/**
 * Normalize MsgSend (bank transfer)
 */
function normalizeMsgSend(
  msg: MsgSend,
  tx: ProcessedInjTx,
  walletAddress: string,
  fiatPrice: number | undefined,
  fee: number,
  feeCurrency: string,
  msgIndex: number
): NormalizedTransaction | null {
  const isSender = msg.from_address.toLowerCase() === walletAddress.toLowerCase();
  const isReceiver = msg.to_address.toLowerCase() === walletAddress.toLowerCase();

  if (!isSender && !isReceiver) return null;

  // Sum up all coins in the transfer
  let totalAmount = 0;
  let currency = "INJ";

  for (const coin of msg.amount) {
    totalAmount += denomAmountToStandard(coin.amount, coin.denom);
    currency = getSymbolFromDenom(coin.denom);
  }

  const type: TransactionType = isSender ? "transfer_sent" : "transfer_received";

  return {
    id: `${tx.hash}-send-${msgIndex}`,
    type,
    timestamp: tx.timestamp,
    sentAmount: isSender ? totalAmount : null,
    sentCurrency: isSender ? currency : null,
    receivedAmount: isReceiver ? totalAmount : null,
    receivedCurrency: isReceiver ? currency : null,
    feeAmount: isSender ? fee : 0,
    feeCurrency,
    transactionHash: tx.hash,
    notes: isSender
      ? `Transfer to ${msg.to_address.slice(0, 10)}...`
      : `Transfer from ${msg.from_address.slice(0, 10)}...`,
    tag: getTagForType(type),
    fiatPrice,
  };
}

/**
 * Normalize MsgTransfer (IBC transfer)
 */
function normalizeMsgTransfer(
  msg: MsgTransfer,
  tx: ProcessedInjTx,
  walletAddress: string,
  fiatPrice: number | undefined,
  fee: number,
  feeCurrency: string,
  msgIndex: number
): NormalizedTransaction | null {
  const isSender = msg.sender.toLowerCase() === walletAddress.toLowerCase();

  if (!isSender) return null;

  const amount = denomAmountToStandard(msg.token.amount, msg.token.denom);
  const currency = getSymbolFromDenom(msg.token.denom);

  return {
    id: `${tx.hash}-ibc-${msgIndex}`,
    type: "transfer_sent",
    timestamp: tx.timestamp,
    sentAmount: amount,
    sentCurrency: currency,
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: fee,
    feeCurrency,
    transactionHash: tx.hash,
    notes: `IBC Transfer to ${msg.receiver.slice(0, 10)}... via ${msg.source_channel}`,
    tag: "wallet_transfer",
    fiatPrice,
  };
}

/**
 * Normalize MsgDelegate (staking)
 */
function normalizeMsgDelegate(
  msg: MsgDelegate,
  tx: ProcessedInjTx,
  fiatPrice: number | undefined,
  fee: number,
  feeCurrency: string,
  msgIndex: number
): NormalizedTransaction {
  const amount = denomAmountToStandard(msg.amount.amount, msg.amount.denom);
  const currency = getSymbolFromDenom(msg.amount.denom);

  return {
    id: `${tx.hash}-delegate-${msgIndex}`,
    type: "stake",
    timestamp: tx.timestamp,
    sentAmount: amount,
    sentCurrency: currency,
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: fee,
    feeCurrency,
    transactionHash: tx.hash,
    notes: `Delegate to ${msg.validator_address.slice(0, 15)}...`,
    tag: "staking_deposit",
    fiatPrice,
  };
}

/**
 * Normalize MsgUndelegate (unstaking)
 */
function normalizeMsgUndelegate(
  msg: MsgUndelegate,
  tx: ProcessedInjTx,
  fiatPrice: number | undefined,
  fee: number,
  feeCurrency: string,
  msgIndex: number
): NormalizedTransaction {
  const amount = denomAmountToStandard(msg.amount.amount, msg.amount.denom);
  const currency = getSymbolFromDenom(msg.amount.denom);

  return {
    id: `${tx.hash}-undelegate-${msgIndex}`,
    type: "unstake",
    timestamp: tx.timestamp,
    sentAmount: null,
    sentCurrency: null,
    receivedAmount: amount,
    receivedCurrency: currency,
    feeAmount: fee,
    feeCurrency,
    transactionHash: tx.hash,
    notes: `Undelegate from ${msg.validator_address.slice(0, 15)}... (${INJECTIVE_UNBONDING_DAYS} day wait)`,
    tag: "unstaking_withdraw",
    fiatPrice,
  };
}

/**
 * Normalize MsgBeginRedelegate
 */
function normalizeMsgRedelegate(
  msg: MsgBeginRedelegate,
  tx: ProcessedInjTx,
  fiatPrice: number | undefined,
  fee: number,
  feeCurrency: string,
  msgIndex: number
): NormalizedTransaction {
  const amount = denomAmountToStandard(msg.amount.amount, msg.amount.denom);
  const currency = getSymbolFromDenom(msg.amount.denom);

  // Redelegate is an internal move, not a taxable event
  // But we track it for completeness
  return {
    id: `${tx.hash}-redelegate-${msgIndex}`,
    type: "stake",
    timestamp: tx.timestamp,
    sentAmount: amount,
    sentCurrency: currency,
    receivedAmount: amount,
    receivedCurrency: currency,
    feeAmount: fee,
    feeCurrency,
    transactionHash: tx.hash,
    notes: `Redelegate from ${msg.validator_src_address.slice(0, 10)}... to ${msg.validator_dst_address.slice(0, 10)}...`,
    tag: "staking_deposit",
    fiatPrice,
  };
}

/**
 * Normalize MsgWithdrawDelegatorReward
 */
function normalizeMsgWithdrawReward(
  msg: MsgWithdrawDelegatorReward,
  tx: ProcessedInjTx,
  walletAddress: string,
  fiatPrice: number | undefined,
  fee: number,
  feeCurrency: string,
  msgIndex: number
): NormalizedTransaction | null {
  // Extract actual reward amount from events
  const rewards = extractStakingRewards(tx.events);

  let totalReward = 0;
  let currency = "INJ";

  for (const reward of rewards) {
    totalReward += denomAmountToStandard(reward.amount, reward.denom);
    if (reward.denom === "inj") {
      currency = "INJ";
    }
  }

  // If no rewards extracted from events, skip
  if (totalReward === 0) {
    return null;
  }

  return {
    id: `${tx.hash}-reward-${msgIndex}`,
    type: "emission_reward",
    timestamp: tx.timestamp,
    sentAmount: null,
    sentCurrency: null,
    receivedAmount: totalReward,
    receivedCurrency: currency,
    feeAmount: fee,
    feeCurrency,
    transactionHash: tx.hash,
    notes: `Staking reward from ${msg.validator_address.slice(0, 15)}...`,
    tag: "claim_rewards",
    fiatPrice,
  };
}

/**
 * Normalize Exchange module messages (spot/derivatives trading)
 */
function normalizeExchangeMessage(
  msg: TxMessage,
  tx: ProcessedInjTx,
  walletAddress: string,
  fiatPrice: number | undefined,
  fee: number,
  feeCurrency: string,
  msgIndex: number
): NormalizedTransaction | null {
  // For now, extract token movements from events for trading
  // Full trading support would require parsing order fills from events
  const { received, sent } = extractTokenMovements(tx.events, walletAddress);

  if (received.length === 0 && sent.length === 0) {
    return null;
  }

  let sentAmount = 0;
  let sentCurrency = "";
  let receivedAmount = 0;
  let receivedCurrency = "";

  for (const coin of sent) {
    sentAmount += denomAmountToStandard(coin.amount, coin.denom);
    sentCurrency = getSymbolFromDenom(coin.denom);
  }

  for (const coin of received) {
    receivedAmount += denomAmountToStandard(coin.amount, coin.denom);
    receivedCurrency = getSymbolFromDenom(coin.denom);
  }

  // Determine if this is a trade (both sent and received) or just transfer
  const isSwap = sentAmount > 0 && receivedAmount > 0;

  return {
    id: `${tx.hash}-exchange-${msgIndex}`,
    type: isSwap ? "swap" : (sentAmount > 0 ? "transfer_sent" : "transfer_received"),
    timestamp: tx.timestamp,
    sentAmount: sentAmount > 0 ? sentAmount : null,
    sentCurrency: sentAmount > 0 ? sentCurrency : null,
    receivedAmount: receivedAmount > 0 ? receivedAmount : null,
    receivedCurrency: receivedAmount > 0 ? receivedCurrency : null,
    feeAmount: fee,
    feeCurrency,
    transactionHash: tx.hash,
    notes: isSwap ? `Swap ${sentCurrency} for ${receivedCurrency}` : "Exchange transaction",
    tag: isSwap ? "trade" : getTagForType(sentAmount > 0 ? "transfer_sent" : "transfer_received"),
    fiatPrice,
  };
}

/**
 * Fallback: normalize from events when message type is unknown
 */
function normalizeFromEvents(
  tx: ProcessedInjTx,
  walletAddress: string,
  priceMap: Map<string, number>,
  fee: number,
  feeCurrency: string
): NormalizedTransaction[] | null {
  const { received, sent } = extractTokenMovements(tx.events, walletAddress);
  const dateKey = tx.timestamp.toISOString().split("T")[0];
  const fiatPrice = priceMap.get(dateKey);

  const results: NormalizedTransaction[] = [];

  // Process received tokens
  for (let i = 0; i < received.length; i++) {
    const coin = received[i];
    const amount = denomAmountToStandard(coin.amount, coin.denom);
    const currency = getSymbolFromDenom(coin.denom);

    results.push({
      id: `${tx.hash}-recv-${i}`,
      type: "transfer_received",
      timestamp: tx.timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: amount,
      receivedCurrency: currency,
      feeAmount: 0,
      feeCurrency,
      transactionHash: tx.hash,
      notes: `Received ${currency}`,
      tag: "receive",
      fiatPrice,
    });
  }

  // Process sent tokens
  for (let i = 0; i < sent.length; i++) {
    const coin = sent[i];
    const amount = denomAmountToStandard(coin.amount, coin.denom);
    const currency = getSymbolFromDenom(coin.denom);

    results.push({
      id: `${tx.hash}-sent-${i}`,
      type: "transfer_sent",
      timestamp: tx.timestamp,
      sentAmount: amount,
      sentCurrency: currency,
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: i === 0 ? fee : 0, // Only first gets fee
      feeCurrency,
      transactionHash: tx.hash,
      notes: `Sent ${currency}`,
      tag: "payment",
      fiatPrice,
    });
  }

  return results.length > 0 ? results : null;
}

/**
 * Merge and sort transactions
 */
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
