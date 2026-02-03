// Normalizes Osmosis transactions to the Awaken.tax CSV format

import type { NormalizedTransaction, TransactionType, AwakenTag } from "@/lib/types";
import type {
  ProcessedOsmoTx,
  TxMessage,
  Coin,
  MsgSend,
  MsgTransfer,
  MsgDelegate,
  MsgUndelegate,
  MsgBeginRedelegate,
  MsgWithdrawDelegatorReward,
  MsgSwapExactAmountIn,
  MsgSwapExactAmountOut,
  MsgJoinPool,
  MsgExitPool,
  MsgLockTokens,
  MsgBeginUnlocking,
} from "./types";
import {
  formatTokenAmount,
  getDenomSymbol,
  uosmoToOsmo,
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

/**
 * Normalizes all transactions for an address.
 */
export function normalizeTransactions(
  transactions: ProcessedOsmoTx[],
  walletAddress: string,
  priceMap: Map<string, number>
): NormalizedTransaction[] {
  const normalized: NormalizedTransaction[] = [];

  for (const tx of transactions) {
    const txResults = normalizeTransaction(tx, walletAddress, priceMap);
    normalized.push(...txResults);
  }

  // Sort by timestamp ascending for tax reporting
  normalized.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return normalized;
}

/**
 * Normalizes a single transaction, potentially returning multiple rows.
 */
function normalizeTransaction(
  tx: ProcessedOsmoTx,
  walletAddress: string,
  priceMap: Map<string, number>
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  const dateStr = tx.timestamp.toISOString().split("T")[0];
  const fiatPrice = priceMap.get(dateStr);

  // Calculate fee in OSMO
  const feeAmount = tx.fee.find((f) => f.denom === "uosmo");
  const feeOsmo = feeAmount ? uosmoToOsmo(feeAmount.amount) : 0;

  // Process each message in the transaction
  for (let i = 0; i < tx.messages.length; i++) {
    const msg = tx.messages[i];
    const isFirstMessage = i === 0;

    const msgResults = normalizeMessage(
      msg,
      tx,
      walletAddress,
      fiatPrice,
      isFirstMessage ? feeOsmo : 0,
      i
    );

    results.push(...msgResults);
  }

  // If no messages were processed, check events for received tokens
  if (results.length === 0) {
    const { received, sent } = extractTokenMovements(tx.events, walletAddress);

    for (let i = 0; i < received.length; i++) {
      const coin = received[i];
      results.push(createReceivedTransaction(coin, tx, fiatPrice, 0, i));
    }

    for (let i = 0; i < sent.length; i++) {
      const coin = sent[i];
      results.push(createSentTransaction(coin, tx, fiatPrice, feeOsmo, i));
    }
  }

  return results;
}

/**
 * Normalizes a single message.
 */
function normalizeMessage(
  msg: TxMessage,
  tx: ProcessedOsmoTx,
  walletAddress: string,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  switch (msg["@type"]) {
    case "/cosmos.bank.v1beta1.MsgSend":
      return normalizeMsgSend(msg as unknown as MsgSend, tx, walletAddress, fiatPrice, fee, msgIndex);

    case "/ibc.applications.transfer.v1.MsgTransfer":
      return normalizeMsgTransfer(msg as unknown as MsgTransfer, tx, fiatPrice, fee, msgIndex);

    case "/cosmos.staking.v1beta1.MsgDelegate":
      return normalizeMsgDelegate(msg as unknown as MsgDelegate, tx, fiatPrice, fee, msgIndex);

    case "/cosmos.staking.v1beta1.MsgUndelegate":
      return normalizeMsgUndelegate(msg as unknown as MsgUndelegate, tx, fiatPrice, fee, msgIndex);

    case "/cosmos.staking.v1beta1.MsgBeginRedelegate":
      return normalizeMsgRedelegate(msg as unknown as MsgBeginRedelegate, tx, fiatPrice, fee, msgIndex);

    case "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward":
      return normalizeMsgWithdrawReward(msg as unknown as MsgWithdrawDelegatorReward, tx, walletAddress, fiatPrice, fee, msgIndex);

    case "/osmosis.gamm.v1beta1.MsgSwapExactAmountIn":
      return normalizeMsgSwapIn(msg as unknown as MsgSwapExactAmountIn, tx, walletAddress, fiatPrice, fee, msgIndex);

    case "/osmosis.gamm.v1beta1.MsgSwapExactAmountOut":
      return normalizeMsgSwapOut(msg as unknown as MsgSwapExactAmountOut, tx, walletAddress, fiatPrice, fee, msgIndex);

    case "/osmosis.gamm.v1beta1.MsgJoinPool":
    case "/osmosis.gamm.v1beta1.MsgJoinSwapExternAmountIn":
      return normalizeMsgJoinPool(msg as unknown as MsgJoinPool, tx, fiatPrice, fee, msgIndex);

    case "/osmosis.gamm.v1beta1.MsgExitPool":
    case "/osmosis.gamm.v1beta1.MsgExitSwapShareAmountIn":
      return normalizeMsgExitPool(msg as unknown as MsgExitPool, tx, fiatPrice, fee, msgIndex);

    case "/osmosis.lockup.MsgLockTokens":
      return normalizeMsgLockTokens(msg as unknown as MsgLockTokens, tx, fiatPrice, fee, msgIndex);

    case "/osmosis.lockup.MsgBeginUnlocking":
      return normalizeMsgUnlockTokens(msg as unknown as MsgBeginUnlocking, tx, fiatPrice, fee, msgIndex);

    default:
      return [];
  }
}

/**
 * Normalizes a MsgSend (bank transfer).
 */
function normalizeMsgSend(
  msg: MsgSend,
  tx: ProcessedOsmoTx,
  walletAddress: string,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  const isReceived = msg.to_address === walletAddress;
  const isSent = msg.from_address === walletAddress;

  for (let i = 0; i < msg.amount.length; i++) {
    const coin = msg.amount[i];
    const amount = formatTokenAmount(coin.amount, coin.denom);
    const symbol = getDenomSymbol(coin.denom);

    if (isReceived) {
      results.push({
        id: `recv-${tx.hash}-${msgIndex}-${i}`,
        type: "transfer_received",
        timestamp: tx.timestamp,
        sentAmount: null,
        sentCurrency: null,
        receivedAmount: amount,
        receivedCurrency: symbol,
        feeAmount: fee > 0 ? fee : 0,
        feeCurrency: "OSMO",
        transactionHash: tx.hash,
        notes: `Received from ${msg.from_address.slice(0, 12)}...`,
        tag: "receive",
        fiatPrice,
      });
    }

    if (isSent) {
      results.push({
        id: `send-${tx.hash}-${msgIndex}-${i}`,
        type: "transfer_sent",
        timestamp: tx.timestamp,
        sentAmount: amount,
        sentCurrency: symbol,
        receivedAmount: null,
        receivedCurrency: null,
        feeAmount: fee,
        feeCurrency: "OSMO",
        transactionHash: tx.hash,
        notes: `Sent to ${msg.to_address.slice(0, 12)}...`,
        tag: "payment",
        fiatPrice,
      });
    }
  }

  return results;
}

/**
 * Normalizes a MsgTransfer (IBC transfer).
 */
function normalizeMsgTransfer(
  msg: MsgTransfer,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const amount = formatTokenAmount(msg.token.amount, msg.token.denom);
  const symbol = getDenomSymbol(msg.token.denom);

  return [{
    id: `ibc-${tx.hash}-${msgIndex}`,
    type: "transfer_sent",
    timestamp: tx.timestamp,
    sentAmount: amount,
    sentCurrency: symbol,
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: fee,
    feeCurrency: "OSMO",
    transactionHash: tx.hash,
    notes: `IBC transfer to ${msg.receiver.slice(0, 12)}... via ${msg.source_channel}`,
    tag: "wallet_transfer",
    fiatPrice,
  }];
}

/**
 * Normalizes a MsgDelegate (stake).
 */
function normalizeMsgDelegate(
  msg: MsgDelegate,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const amount = formatTokenAmount(msg.amount.amount, msg.amount.denom);
  const symbol = getDenomSymbol(msg.amount.denom);

  return [{
    id: `delegate-${tx.hash}-${msgIndex}`,
    type: "stake",
    timestamp: tx.timestamp,
    sentAmount: amount,
    sentCurrency: symbol,
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: fee,
    feeCurrency: "OSMO",
    transactionHash: tx.hash,
    notes: `Delegated to ${msg.validator_address.slice(0, 16)}...`,
    tag: "staking_deposit",
    fiatPrice,
  }];
}

/**
 * Normalizes a MsgUndelegate (unstake).
 */
function normalizeMsgUndelegate(
  msg: MsgUndelegate,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const amount = formatTokenAmount(msg.amount.amount, msg.amount.denom);
  const symbol = getDenomSymbol(msg.amount.denom);

  return [{
    id: `undelegate-${tx.hash}-${msgIndex}`,
    type: "unstake",
    timestamp: tx.timestamp,
    sentAmount: null,
    sentCurrency: null,
    receivedAmount: amount,
    receivedCurrency: symbol,
    feeAmount: fee,
    feeCurrency: "OSMO",
    transactionHash: tx.hash,
    notes: `Undelegated from ${msg.validator_address.slice(0, 16)}...`,
    tag: "unstaking_withdraw",
    fiatPrice,
  }];
}

/**
 * Normalizes a MsgBeginRedelegate.
 */
function normalizeMsgRedelegate(
  msg: MsgBeginRedelegate,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const amount = formatTokenAmount(msg.amount.amount, msg.amount.denom);
  const symbol = getDenomSymbol(msg.amount.denom);

  // Redelegate is a non-taxable event (no change in ownership)
  return [{
    id: `redelegate-${tx.hash}-${msgIndex}`,
    type: "stake",
    timestamp: tx.timestamp,
    sentAmount: null,
    sentCurrency: null,
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: fee,
    feeCurrency: "OSMO",
    transactionHash: tx.hash,
    notes: `Redelegated ${amount} ${symbol} from ${msg.validator_src_address.slice(0, 12)}... to ${msg.validator_dst_address.slice(0, 12)}...`,
    tag: "staking_deposit",
    fiatPrice,
  }];
}

/**
 * Normalizes a MsgWithdrawDelegatorReward.
 */
function normalizeMsgWithdrawReward(
  msg: MsgWithdrawDelegatorReward,
  tx: ProcessedOsmoTx,
  walletAddress: string,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  // Extract rewards from events
  const rewards = extractStakingRewards(tx.events);

  if (rewards.length === 0) {
    // Try to extract from coin_received events
    const { received } = extractTokenMovements(tx.events, walletAddress);
    for (const coin of received) {
      rewards.push(coin);
    }
  }

  const results: NormalizedTransaction[] = [];

  for (let i = 0; i < rewards.length; i++) {
    const reward = rewards[i];
    const amount = formatTokenAmount(reward.amount, reward.denom);
    const symbol = getDenomSymbol(reward.denom);

    results.push({
      id: `reward-${tx.hash}-${msgIndex}-${i}`,
      type: "emission_reward",
      timestamp: tx.timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: amount,
      receivedCurrency: symbol,
      feeAmount: results.length === 0 ? fee : 0,
      feeCurrency: "OSMO",
      transactionHash: tx.hash,
      notes: `Staking reward from ${msg.validator_address.slice(0, 16)}...`,
      tag: "claim_rewards",
      fiatPrice,
    });
  }

  // If no rewards found, still record the transaction for the fee
  if (results.length === 0 && fee > 0) {
    results.push({
      id: `reward-${tx.hash}-${msgIndex}`,
      type: "emission_reward",
      timestamp: tx.timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: fee,
      feeCurrency: "OSMO",
      transactionHash: tx.hash,
      notes: "Claimed staking rewards (0 rewards)",
      tag: "claim_rewards",
      fiatPrice,
    });
  }

  return results;
}

/**
 * Normalizes a MsgSwapExactAmountIn.
 */
function normalizeMsgSwapIn(
  msg: MsgSwapExactAmountIn,
  tx: ProcessedOsmoTx,
  walletAddress: string,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const sentAmount = formatTokenAmount(msg.token_in.amount, msg.token_in.denom);
  const sentSymbol = getDenomSymbol(msg.token_in.denom);

  // Get the output token from events
  const { received } = extractTokenMovements(tx.events, walletAddress);
  const outputToken = received.length > 0 ? received[0] : null;

  const receivedAmount = outputToken ? formatTokenAmount(outputToken.amount, outputToken.denom) : null;
  const receivedSymbol = outputToken ? getDenomSymbol(outputToken.denom) : null;

  return [{
    id: `swap-${tx.hash}-${msgIndex}`,
    type: "transfer_sent",
    timestamp: tx.timestamp,
    sentAmount,
    sentCurrency: sentSymbol,
    receivedAmount,
    receivedCurrency: receivedSymbol,
    feeAmount: fee,
    feeCurrency: "OSMO",
    transactionHash: tx.hash,
    notes: `Swap ${sentSymbol} for ${receivedSymbol || "unknown"}`,
    tag: "payment",
    fiatPrice,
  }];
}

/**
 * Normalizes a MsgSwapExactAmountOut.
 */
function normalizeMsgSwapOut(
  msg: MsgSwapExactAmountOut,
  tx: ProcessedOsmoTx,
  walletAddress: string,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const receivedAmount = formatTokenAmount(msg.token_out.amount, msg.token_out.denom);
  const receivedSymbol = getDenomSymbol(msg.token_out.denom);

  // Get the input token from events
  const { sent } = extractTokenMovements(tx.events, walletAddress);
  const inputToken = sent.length > 0 ? sent[0] : null;

  const sentAmount = inputToken ? formatTokenAmount(inputToken.amount, inputToken.denom) : null;
  const sentSymbol = inputToken ? getDenomSymbol(inputToken.denom) : null;

  return [{
    id: `swap-${tx.hash}-${msgIndex}`,
    type: "transfer_sent",
    timestamp: tx.timestamp,
    sentAmount,
    sentCurrency: sentSymbol,
    receivedAmount,
    receivedCurrency: receivedSymbol,
    feeAmount: fee,
    feeCurrency: "OSMO",
    transactionHash: tx.hash,
    notes: `Swap ${sentSymbol || "unknown"} for ${receivedSymbol}`,
    tag: "payment",
    fiatPrice,
  }];
}

/**
 * Normalizes a MsgJoinPool (add liquidity).
 */
function normalizeMsgJoinPool(
  msg: MsgJoinPool,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  const tokens = msg.token_in_maxs || [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const amount = formatTokenAmount(token.amount, token.denom);
    const symbol = getDenomSymbol(token.denom);

    results.push({
      id: `lp-join-${tx.hash}-${msgIndex}-${i}`,
      type: "transfer_sent",
      timestamp: tx.timestamp,
      sentAmount: amount,
      sentCurrency: symbol,
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: results.length === 0 ? fee : 0,
      feeCurrency: "OSMO",
      transactionHash: tx.hash,
      notes: `Added liquidity to pool ${msg.pool_id}`,
      tag: "payment",
      fiatPrice,
    });
  }

  return results;
}

/**
 * Normalizes a MsgExitPool (remove liquidity).
 */
function normalizeMsgExitPool(
  msg: MsgExitPool,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  const tokens = msg.token_out_mins || [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const amount = formatTokenAmount(token.amount, token.denom);
    const symbol = getDenomSymbol(token.denom);

    results.push({
      id: `lp-exit-${tx.hash}-${msgIndex}-${i}`,
      type: "transfer_received",
      timestamp: tx.timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: amount,
      receivedCurrency: symbol,
      feeAmount: results.length === 0 ? fee : 0,
      feeCurrency: "OSMO",
      transactionHash: tx.hash,
      notes: `Removed liquidity from pool ${msg.pool_id}`,
      tag: "receive",
      fiatPrice,
    });
  }

  return results;
}

/**
 * Normalizes a MsgLockTokens (lock LP tokens).
 */
function normalizeMsgLockTokens(
  msg: MsgLockTokens,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  const coins = msg.coins || [];

  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];
    const amount = formatTokenAmount(coin.amount, coin.denom);
    const symbol = getDenomSymbol(coin.denom);

    results.push({
      id: `lock-${tx.hash}-${msgIndex}-${i}`,
      type: "stake",
      timestamp: tx.timestamp,
      sentAmount: amount,
      sentCurrency: symbol,
      receivedAmount: null,
      receivedCurrency: null,
      feeAmount: results.length === 0 ? fee : 0,
      feeCurrency: "OSMO",
      transactionHash: tx.hash,
      notes: `Locked ${symbol} for ${msg.duration}`,
      tag: "staking_deposit",
      fiatPrice,
    });
  }

  return results;
}

/**
 * Normalizes a MsgBeginUnlocking.
 */
function normalizeMsgUnlockTokens(
  msg: MsgBeginUnlocking,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  msgIndex: number
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  const coins = msg.coins || [];

  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];
    const amount = formatTokenAmount(coin.amount, coin.denom);
    const symbol = getDenomSymbol(coin.denom);

    results.push({
      id: `unlock-${tx.hash}-${msgIndex}-${i}`,
      type: "unstake",
      timestamp: tx.timestamp,
      sentAmount: null,
      sentCurrency: null,
      receivedAmount: amount,
      receivedCurrency: symbol,
      feeAmount: results.length === 0 ? fee : 0,
      feeCurrency: "OSMO",
      transactionHash: tx.hash,
      notes: `Unlocking ${symbol} (lock ID: ${msg.ID})`,
      tag: "unstaking_withdraw",
      fiatPrice,
    });
  }

  return results;
}

/**
 * Creates a received transaction from a Coin.
 */
function createReceivedTransaction(
  coin: Coin,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  index: number
): NormalizedTransaction {
  const amount = formatTokenAmount(coin.amount, coin.denom);
  const symbol = getDenomSymbol(coin.denom);

  return {
    id: `recv-event-${tx.hash}-${index}`,
    type: "transfer_received",
    timestamp: tx.timestamp,
    sentAmount: null,
    sentCurrency: null,
    receivedAmount: amount,
    receivedCurrency: symbol,
    feeAmount: fee,
    feeCurrency: "OSMO",
    transactionHash: tx.hash,
    notes: "Token received",
    tag: "receive",
    fiatPrice,
  };
}

/**
 * Creates a sent transaction from a Coin.
 */
function createSentTransaction(
  coin: Coin,
  tx: ProcessedOsmoTx,
  fiatPrice: number | undefined,
  fee: number,
  index: number
): NormalizedTransaction {
  const amount = formatTokenAmount(coin.amount, coin.denom);
  const symbol = getDenomSymbol(coin.denom);

  return {
    id: `send-event-${tx.hash}-${index}`,
    type: "transfer_sent",
    timestamp: tx.timestamp,
    sentAmount: amount,
    sentCurrency: symbol,
    receivedAmount: null,
    receivedCurrency: null,
    feeAmount: fee,
    feeCurrency: "OSMO",
    transactionHash: tx.hash,
    notes: "Token sent",
    tag: "payment",
    fiatPrice,
  };
}
