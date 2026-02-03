// Kava Transaction Normalizer - Cosmos + EVM Support

import type {
  NormalizedTransaction,
  TransactionType,
  AwakenTag,
} from "@/lib/types";
import {
  type KavaTxResponse,
  type KavaMessage,
  type EVMTokenTransfer,
  KAVA_MSG_DESCRIPTIONS,
  EVM_TOKENS,
} from "./types";
import {
  parseCoin,
  getTxFee,
  fetchKavaPrice,
  getUniqueDates,
  extractEvents,
  extractTransferEvents,
  microToStandard,
} from "./api";

// Map message type to internal transaction type
function getTransactionType(
  msgType: string,
  address: string,
  msg: KavaMessage
): TransactionType {
  switch (msgType) {
    // Bank transfers
    case "/cosmos.bank.v1beta1.MsgSend":
      return msg.from_address === address ? "transfer_sent" : "transfer_received";

    case "/cosmos.bank.v1beta1.MsgMultiSend":
      return "transfer_sent";

    // Staking
    case "/cosmos.staking.v1beta1.MsgDelegate":
      return "stake";

    case "/cosmos.staking.v1beta1.MsgUndelegate":
      return "unstake";

    case "/cosmos.staking.v1beta1.MsgBeginRedelegate":
      return "stake";

    // Rewards
    case "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward":
    case "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission":
      return "emission_reward";

    // IBC
    case "/ibc.applications.transfer.v1.MsgTransfer":
      return "transfer_sent";

    // CDP
    case "/kava.cdp.v1beta1.MsgCreateCDP":
    case "/kava.cdp.v1beta1.MsgDeposit":
      return "stake";

    case "/kava.cdp.v1beta1.MsgWithdraw":
      return "unstake";

    case "/kava.cdp.v1beta1.MsgDrawDebt":
      return "transfer_received";

    case "/kava.cdp.v1beta1.MsgRepayDebt":
      return "transfer_sent";

    case "/kava.cdp.v1beta1.MsgLiquidate":
      return "slash";

    // Hard (Lending)
    case "/kava.hard.v1beta1.MsgDeposit":
      return "stake";

    case "/kava.hard.v1beta1.MsgWithdraw":
      return "unstake";

    case "/kava.hard.v1beta1.MsgBorrow":
      return "transfer_received";

    case "/kava.hard.v1beta1.MsgRepay":
      return "transfer_sent";

    case "/kava.hard.v1beta1.MsgLiquidate":
      return "slash";

    // Swap (DEX)
    case "/kava.swap.v1beta1.MsgDeposit":
      return "liquidity_add";

    case "/kava.swap.v1beta1.MsgWithdraw":
      return "liquidity_remove";

    case "/kava.swap.v1beta1.MsgSwapExactForTokens":
    case "/kava.swap.v1beta1.MsgSwapForExactTokens":
      return "swap";

    // Incentive (Rewards)
    case "/kava.incentive.v1beta1.MsgClaimUSDXMintingReward":
    case "/kava.incentive.v1beta1.MsgClaimHardReward":
    case "/kava.incentive.v1beta1.MsgClaimDelegatorReward":
    case "/kava.incentive.v1beta1.MsgClaimSwapReward":
    case "/kava.incentive.v1beta1.MsgClaimSavingsReward":
    case "/kava.incentive.v1beta1.MsgClaimEarnReward":
      return "emission_reward";

    // Earn
    case "/kava.earn.v1beta1.MsgDeposit":
      return "stake";

    case "/kava.earn.v1beta1.MsgWithdraw":
      return "unstake";

    // Liquid Staking
    case "/kava.liquid.v1beta1.MsgMintDerivative":
      return "stake";

    case "/kava.liquid.v1beta1.MsgBurnDerivative":
      return "unstake";

    // EVM Bridge
    case "/kava.evmutil.v1beta1.MsgConvertCoinToERC20":
    case "/kava.evmutil.v1beta1.MsgConvertERC20ToCoin":
      return "transfer_sent";

    // BEP3
    case "/kava.bep3.v1beta1.MsgCreateAtomicSwap":
      return "transfer_sent";

    case "/kava.bep3.v1beta1.MsgClaimAtomicSwap":
    case "/kava.bep3.v1beta1.MsgRefundAtomicSwap":
      return "transfer_received";

    // Auction
    case "/kava.auction.v1beta1.MsgPlaceBid":
      return "transfer_sent";

    default:
      return "transfer_sent";
  }
}

// Map message type to Awaken tag
function getAwakenTag(
  msgType: string,
  address: string,
  msg: KavaMessage
): AwakenTag {
  switch (msgType) {
    // Bank transfers
    case "/cosmos.bank.v1beta1.MsgSend":
      return msg.from_address === address ? "payment" : "receive";

    case "/cosmos.bank.v1beta1.MsgMultiSend":
      return "payment";

    // Staking
    case "/cosmos.staking.v1beta1.MsgDelegate":
      return "staking_deposit";

    case "/cosmos.staking.v1beta1.MsgUndelegate":
      return "unstaking_withdraw";

    case "/cosmos.staking.v1beta1.MsgBeginRedelegate":
      return "wallet_transfer";

    // Rewards
    case "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward":
    case "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission":
      return "claim_rewards";

    // IBC
    case "/ibc.applications.transfer.v1.MsgTransfer":
      return "wallet_transfer";

    // CDP
    case "/kava.cdp.v1beta1.MsgCreateCDP":
    case "/kava.cdp.v1beta1.MsgDeposit":
      return "staking_deposit";

    case "/kava.cdp.v1beta1.MsgWithdraw":
      return "unstaking_withdraw";

    case "/kava.cdp.v1beta1.MsgDrawDebt":
      return "receive";

    case "/kava.cdp.v1beta1.MsgRepayDebt":
      return "payment";

    case "/kava.cdp.v1beta1.MsgLiquidate":
      return "lost";

    // Hard (Lending)
    case "/kava.hard.v1beta1.MsgDeposit":
      return "staking_deposit";

    case "/kava.hard.v1beta1.MsgWithdraw":
      return "unstaking_withdraw";

    case "/kava.hard.v1beta1.MsgBorrow":
      return "receive";

    case "/kava.hard.v1beta1.MsgRepay":
      return "payment";

    case "/kava.hard.v1beta1.MsgLiquidate":
      return "lost";

    // Swap (DEX)
    case "/kava.swap.v1beta1.MsgDeposit":
      return "payment";

    case "/kava.swap.v1beta1.MsgWithdraw":
      return "receive";

    case "/kava.swap.v1beta1.MsgSwapExactForTokens":
    case "/kava.swap.v1beta1.MsgSwapForExactTokens":
      return "trade";

    // Incentive (Rewards)
    case "/kava.incentive.v1beta1.MsgClaimUSDXMintingReward":
    case "/kava.incentive.v1beta1.MsgClaimHardReward":
    case "/kava.incentive.v1beta1.MsgClaimDelegatorReward":
    case "/kava.incentive.v1beta1.MsgClaimSwapReward":
    case "/kava.incentive.v1beta1.MsgClaimSavingsReward":
    case "/kava.incentive.v1beta1.MsgClaimEarnReward":
      return "claim_rewards";

    // Earn
    case "/kava.earn.v1beta1.MsgDeposit":
      return "staking_deposit";

    case "/kava.earn.v1beta1.MsgWithdraw":
      return "unstaking_withdraw";

    // Liquid Staking
    case "/kava.liquid.v1beta1.MsgMintDerivative":
      return "staking_deposit";

    case "/kava.liquid.v1beta1.MsgBurnDerivative":
      return "unstaking_withdraw";

    // EVM Bridge
    case "/kava.evmutil.v1beta1.MsgConvertCoinToERC20":
    case "/kava.evmutil.v1beta1.MsgConvertERC20ToCoin":
      return "wallet_transfer";

    // BEP3
    case "/kava.bep3.v1beta1.MsgCreateAtomicSwap":
      return "payment";

    case "/kava.bep3.v1beta1.MsgClaimAtomicSwap":
    case "/kava.bep3.v1beta1.MsgRefundAtomicSwap":
      return "receive";

    // Auction
    case "/kava.auction.v1beta1.MsgPlaceBid":
      return "payment";

    default:
      return "payment";
  }
}

// Parse coin amount string like "1234ukava" or "1234567usdx"
function parseAmountString(amountStr: string): { amount: number; symbol: string } | null {
  if (!amountStr) return null;

  // Handle multiple coins separated by comma
  const parts = amountStr.split(",");
  if (parts.length > 0) {
    const firstPart = parts[0].trim();
    const match = firstPart.match(/^(\d+)(.+)$/);
    if (match) {
      const parsed = parseCoin({ denom: match[2], amount: match[1] });
      return { amount: parsed.amount, symbol: parsed.symbol };
    }
  }

  return null;
}

// Extract amounts from a message with improved event parsing
function extractAmounts(
  msg: KavaMessage,
  msgType: string,
  address: string,
  tx: KavaTxResponse
): {
  sentAmount: number | null;
  sentCurrency: string | null;
  receivedAmount: number | null;
  receivedCurrency: string | null;
} {
  let sentAmount: number | null = null;
  let sentCurrency: string | null = null;
  let receivedAmount: number | null = null;
  let receivedCurrency: string | null = null;

  switch (msgType) {
    // Bank transfer
    case "/cosmos.bank.v1beta1.MsgSend": {
      if (msg.amount && msg.amount.length > 0) {
        const parsed = parseCoin(msg.amount[0]);
        if (msg.from_address === address) {
          sentAmount = parsed.amount;
          sentCurrency = parsed.symbol;
        } else {
          receivedAmount = parsed.amount;
          receivedCurrency = parsed.symbol;
        }
      }
      break;
    }

    // Staking - extract from message or events
    case "/cosmos.staking.v1beta1.MsgDelegate": {
      // Try message first
      if (msg.amount) {
        const coin = msg.amount as unknown as { denom: string; amount: string };
        if (coin.denom && coin.amount) {
          const parsed = parseCoin(coin);
          sentAmount = parsed.amount;
          sentCurrency = parsed.symbol;
        }
      }
      break;
    }

    case "/cosmos.staking.v1beta1.MsgUndelegate": {
      if (msg.amount) {
        const coin = msg.amount as unknown as { denom: string; amount: string };
        if (coin.denom && coin.amount) {
          const parsed = parseCoin(coin);
          receivedAmount = parsed.amount;
          receivedCurrency = parsed.symbol;
        }
      }
      break;
    }

    // Staking rewards - extract from events
    case "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": {
      // Try multiple event types
      const rewardEvents = extractEvents(tx, "withdraw_rewards");
      const coinSpentEvents = extractEvents(tx, "coin_spent");
      const coinReceivedEvents = extractEvents(tx, "coin_received");

      // Check withdraw_rewards event
      if (rewardEvents.length > 0 && rewardEvents[0].amount) {
        const parsed = parseAmountString(rewardEvents[0].amount);
        if (parsed) {
          receivedAmount = parsed.amount;
          receivedCurrency = parsed.symbol;
        }
      }

      // Fallback to coin_received events
      if (receivedAmount === null && coinReceivedEvents.length > 0) {
        for (const event of coinReceivedEvents) {
          if (event.receiver === address && event.amount) {
            const parsed = parseAmountString(event.amount);
            if (parsed) {
              receivedAmount = parsed.amount;
              receivedCurrency = parsed.symbol;
              break;
            }
          }
        }
      }

      // Fallback to transfer events
      if (receivedAmount === null) {
        const transfers = extractTransferEvents(tx, address);
        for (const transfer of transfers) {
          if (transfer.recipient === address && transfer.amount) {
            const parsed = parseAmountString(transfer.amount);
            if (parsed) {
              receivedAmount = parsed.amount;
              receivedCurrency = parsed.symbol;
              break;
            }
          }
        }
      }
      break;
    }

    // CDP operations
    case "/kava.cdp.v1beta1.MsgCreateCDP": {
      if (msg.collateral) {
        const parsed = parseCoin(msg.collateral);
        sentAmount = parsed.amount;
        sentCurrency = parsed.symbol;
      }
      if (msg.principal) {
        const parsed = parseCoin(msg.principal);
        receivedAmount = parsed.amount;
        receivedCurrency = parsed.symbol;
      }
      break;
    }

    case "/kava.cdp.v1beta1.MsgDeposit": {
      if (msg.collateral) {
        const parsed = parseCoin(msg.collateral);
        sentAmount = parsed.amount;
        sentCurrency = parsed.symbol;
      }
      break;
    }

    case "/kava.cdp.v1beta1.MsgWithdraw": {
      if (msg.collateral) {
        const parsed = parseCoin(msg.collateral);
        receivedAmount = parsed.amount;
        receivedCurrency = parsed.symbol;
      }
      break;
    }

    case "/kava.cdp.v1beta1.MsgDrawDebt": {
      if (msg.principal) {
        const parsed = parseCoin(msg.principal);
        receivedAmount = parsed.amount;
        receivedCurrency = parsed.symbol;
      }
      break;
    }

    case "/kava.cdp.v1beta1.MsgRepayDebt": {
      if (msg.payment) {
        const parsed = parseCoin(msg.payment);
        sentAmount = parsed.amount;
        sentCurrency = parsed.symbol;
      }
      break;
    }

    // Hard operations
    case "/kava.hard.v1beta1.MsgDeposit":
    case "/kava.hard.v1beta1.MsgRepay": {
      if (msg.amount && Array.isArray(msg.amount) && msg.amount.length > 0) {
        const parsed = parseCoin(msg.amount[0]);
        sentAmount = parsed.amount;
        sentCurrency = parsed.symbol;
      }
      break;
    }

    case "/kava.hard.v1beta1.MsgWithdraw":
    case "/kava.hard.v1beta1.MsgBorrow": {
      if (msg.amount && Array.isArray(msg.amount) && msg.amount.length > 0) {
        const parsed = parseCoin(msg.amount[0]);
        receivedAmount = parsed.amount;
        receivedCurrency = parsed.symbol;
      }
      break;
    }

    // Swap operations
    case "/kava.swap.v1beta1.MsgSwapExactForTokens": {
      if (msg.exact_token_a) {
        const parsed = parseCoin(msg.exact_token_a);
        sentAmount = parsed.amount;
        sentCurrency = parsed.symbol;
      }
      // Get actual received amount from events
      const swapEvents = extractEvents(tx, "swap_trade");
      if (swapEvents.length > 0 && swapEvents[0].output) {
        const parsed = parseAmountString(swapEvents[0].output);
        if (parsed) {
          receivedAmount = parsed.amount;
          receivedCurrency = parsed.symbol;
        }
      } else if (msg.token_b) {
        // Fallback to expected amount
        const parsed = parseCoin(msg.token_b);
        receivedAmount = parsed.amount;
        receivedCurrency = parsed.symbol;
      }
      break;
    }

    case "/kava.swap.v1beta1.MsgSwapForExactTokens": {
      if (msg.exact_token_b) {
        const parsed = parseCoin(msg.exact_token_b);
        receivedAmount = parsed.amount;
        receivedCurrency = parsed.symbol;
      }
      // Get actual sent amount from events
      const swapEvents = extractEvents(tx, "swap_trade");
      if (swapEvents.length > 0 && swapEvents[0].input) {
        const parsed = parseAmountString(swapEvents[0].input);
        if (parsed) {
          sentAmount = parsed.amount;
          sentCurrency = parsed.symbol;
        }
      } else if (msg.token_a) {
        const parsed = parseCoin(msg.token_a);
        sentAmount = parsed.amount;
        sentCurrency = parsed.symbol;
      }
      break;
    }

    // Incentive claims - extract from events
    case "/kava.incentive.v1beta1.MsgClaimUSDXMintingReward":
    case "/kava.incentive.v1beta1.MsgClaimHardReward":
    case "/kava.incentive.v1beta1.MsgClaimDelegatorReward":
    case "/kava.incentive.v1beta1.MsgClaimSwapReward":
    case "/kava.incentive.v1beta1.MsgClaimSavingsReward":
    case "/kava.incentive.v1beta1.MsgClaimEarnReward": {
      // Try claim_reward event
      const claimEvents = extractEvents(tx, "claim_reward");
      if (claimEvents.length > 0) {
        const amountStr = claimEvents[0].claim_amount || claimEvents[0].amount;
        if (amountStr) {
          const parsed = parseAmountString(amountStr);
          if (parsed) {
            receivedAmount = parsed.amount;
            receivedCurrency = parsed.symbol;
          }
        }
      }

      // Fallback to coin_received
      if (receivedAmount === null) {
        const coinEvents = extractEvents(tx, "coin_received");
        for (const event of coinEvents) {
          if (event.receiver === address && event.amount) {
            const parsed = parseAmountString(event.amount);
            if (parsed) {
              receivedAmount = parsed.amount;
              receivedCurrency = parsed.symbol;
              break;
            }
          }
        }
      }

      // Fallback to transfer events
      if (receivedAmount === null) {
        const transfers = extractTransferEvents(tx, address);
        if (transfers.length > 0 && transfers[0].amount) {
          const parsed = parseAmountString(transfers[0].amount);
          if (parsed) {
            receivedAmount = parsed.amount;
            receivedCurrency = parsed.symbol;
          }
        }
      }
      break;
    }

    // IBC transfer
    case "/ibc.applications.transfer.v1.MsgTransfer": {
      if (msg.token) {
        const parsed = parseCoin(msg.token);
        sentAmount = parsed.amount;
        sentCurrency = parsed.symbol;
      }
      break;
    }

    // Liquid staking
    case "/kava.liquid.v1beta1.MsgMintDerivative": {
      if (msg.amount) {
        const coin = msg.amount as unknown as { denom: string; amount: string };
        if (coin.denom && coin.amount) {
          const parsed = parseCoin(coin);
          sentAmount = parsed.amount;
          sentCurrency = parsed.symbol;
          // bKAVA received is 1:1
          receivedAmount = parsed.amount;
          receivedCurrency = "bKAVA";
        }
      }
      break;
    }

    case "/kava.liquid.v1beta1.MsgBurnDerivative": {
      if (msg.amount) {
        const coin = msg.amount as unknown as { denom: string; amount: string };
        if (coin.denom && coin.amount) {
          const parsed = parseCoin(coin);
          sentAmount = parsed.amount;
          sentCurrency = "bKAVA";
          receivedAmount = parsed.amount;
          receivedCurrency = "KAVA";
        }
      }
      break;
    }

    // Earn module
    case "/kava.earn.v1beta1.MsgDeposit": {
      if (msg.amount) {
        const coin = msg.amount as unknown as { denom: string; amount: string };
        if (coin.denom && coin.amount) {
          const parsed = parseCoin(coin);
          sentAmount = parsed.amount;
          sentCurrency = parsed.symbol;
        }
      }
      break;
    }

    case "/kava.earn.v1beta1.MsgWithdraw": {
      if (msg.amount) {
        const coin = msg.amount as unknown as { denom: string; amount: string };
        if (coin.denom && coin.amount) {
          const parsed = parseCoin(coin);
          receivedAmount = parsed.amount;
          receivedCurrency = parsed.symbol;
        }
      }
      break;
    }
  }

  return { sentAmount, sentCurrency, receivedAmount, receivedCurrency };
}

// Process a single Cosmos transaction
function processCosmosTransaction(
  tx: KavaTxResponse,
  address: string,
  kavaPrices: Map<string, number>
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];
  const timestamp = new Date(tx.timestamp);
  const dateStr = timestamp.toISOString().split("T")[0];
  const kavaPrice = kavaPrices.get(dateStr);

  const fee = getTxFee(tx);
  const messages = tx.tx?.body?.messages || [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgType = msg["@type"];

    const type = getTransactionType(msgType, address, msg);
    const tag = getAwakenTag(msgType, address, msg);
    const { sentAmount, sentCurrency, receivedAmount, receivedCurrency } =
      extractAmounts(msg, msgType, address, tx);

    const notes =
      KAVA_MSG_DESCRIPTIONS[msgType] ||
      msgType.split(".").pop()?.replace("Msg", "") ||
      "Unknown";

    // Only charge fee on first message (to avoid double counting)
    const feeAmount = i === 0 ? fee.amount : 0;

    results.push({
      id: `${tx.txhash}-${i}`,
      type,
      timestamp,
      sentAmount,
      sentCurrency,
      receivedAmount,
      receivedCurrency,
      feeAmount,
      feeCurrency: fee.symbol,
      transactionHash: tx.txhash,
      notes,
      tag,
      fiatPrice: kavaPrice,
    });
  }

  return results;
}

// Process EVM token transfer
function processEvmTransfer(
  transfer: EVMTokenTransfer,
  evmAddress: string,
  kavaPrices: Map<string, number>
): NormalizedTransaction {
  const timestamp = new Date(parseInt(transfer.timeStamp) * 1000);
  const dateStr = timestamp.toISOString().split("T")[0];
  const kavaPrice = kavaPrices.get(dateStr);

  const tokenAddress = transfer.contractAddress.toLowerCase();
  const tokenInfo = EVM_TOKENS[tokenAddress] || {
    symbol: transfer.tokenSymbol || "UNKNOWN",
    decimals: parseInt(transfer.tokenDecimal) || 18,
    coingeckoId: "",
  };

  // Parse value from hex
  const valueHex = transfer.value;
  const valueBigInt = BigInt(valueHex);
  const amount = Number(valueBigInt) / Math.pow(10, tokenInfo.decimals);

  const isReceived = transfer.to.toLowerCase() === evmAddress.toLowerCase();

  return {
    id: `evm-${transfer.hash}`,
    type: isReceived ? "token_received" : "token_sent",
    timestamp,
    sentAmount: isReceived ? null : amount,
    sentCurrency: isReceived ? null : tokenInfo.symbol,
    receivedAmount: isReceived ? amount : null,
    receivedCurrency: isReceived ? tokenInfo.symbol : null,
    feeAmount: 0, // EVM fees are in the native transaction, not the transfer
    feeCurrency: "KAVA",
    transactionHash: transfer.hash,
    notes: `EVM ${isReceived ? "Receive" : "Send"} ${tokenInfo.symbol}`,
    tag: isReceived ? "receive" : "payment",
    fiatPrice: kavaPrice,
  };
}

// Main function to normalize all transactions
export async function normalizeKavaTransactions(
  cosmosTransactions: KavaTxResponse[],
  evmTransfers: EVMTokenTransfer[],
  address: string,
  evmAddress: string | null,
  onProgress?: (message: string) => void
): Promise<NormalizedTransaction[]> {
  if (cosmosTransactions.length === 0 && evmTransfers.length === 0) {
    return [];
  }

  onProgress?.("Fetching historical KAVA prices...");

  // Collect all unique dates
  const allDates = new Set<string>();

  for (const tx of cosmosTransactions) {
    const timestamp = new Date(tx.timestamp);
    const dateStr = timestamp.toISOString().split("T")[0];
    allDates.add(dateStr);
  }

  for (const transfer of evmTransfers) {
    const timestamp = new Date(parseInt(transfer.timeStamp) * 1000);
    const dateStr = timestamp.toISOString().split("T")[0];
    allDates.add(dateStr);
  }

  // Fetch KAVA prices for unique dates (limit to 30 to avoid rate limiting)
  const kavaPrices = new Map<string, number>();
  const datesToFetch = Array.from(allDates).slice(0, 30);

  for (const dateStr of datesToFetch) {
    const [year, month, day] = dateStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const price = await fetchKavaPrice(date);
    if (price !== null) {
      kavaPrices.set(dateStr, price);
    }
  }

  onProgress?.("Processing Cosmos transactions...");

  // Process Cosmos transactions
  const normalizedTxs: NormalizedTransaction[] = [];

  for (const tx of cosmosTransactions) {
    const processed = processCosmosTransaction(tx, address, kavaPrices);
    normalizedTxs.push(...processed);
  }

  // Process EVM transfers
  if (evmTransfers.length > 0 && evmAddress) {
    onProgress?.("Processing EVM transactions...");

    for (const transfer of evmTransfers) {
      const processed = processEvmTransfer(transfer, evmAddress, kavaPrices);
      normalizedTxs.push(processed);
    }
  }

  // Sort by timestamp descending (most recent first)
  normalizedTxs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return normalizedTxs;
}

// Calculate summary statistics
export function calculateSummary(transactions: NormalizedTransaction[]) {
  let totalReceived = 0;
  let totalSent = 0;
  let totalFees = 0;
  const assets = new Set<string>();

  let stakingTxs = 0;
  let swapTxs = 0;
  let rewardClaims = 0;
  let cdpTxs = 0;
  let evmTxs = 0;

  for (const tx of transactions) {
    if (tx.receivedCurrency) {
      assets.add(tx.receivedCurrency);
      if (tx.receivedCurrency === "KAVA" && tx.receivedAmount) {
        totalReceived += tx.receivedAmount;
      }
    }

    if (tx.sentCurrency) {
      assets.add(tx.sentCurrency);
      if (tx.sentCurrency === "KAVA" && tx.sentAmount) {
        totalSent += tx.sentAmount;
      }
    }

    if (tx.feeAmount && tx.feeCurrency === "KAVA") {
      totalFees += tx.feeAmount;
    }

    // Count transaction types
    if (tx.tag === "staking_deposit" || tx.tag === "unstaking_withdraw") {
      stakingTxs++;
    }
    if (tx.tag === "trade") {
      swapTxs++;
    }
    if (tx.tag === "claim_rewards") {
      rewardClaims++;
    }
    if (tx.notes.includes("CDP") || tx.notes.includes("USDX")) {
      cdpTxs++;
    }
    if (tx.notes.includes("EVM")) {
      evmTxs++;
    }
  }

  return {
    totalTransactions: transactions.length,
    totalReceived,
    totalSent,
    totalFees,
    stakingTransactions: stakingTxs,
    swapTransactions: swapTxs,
    rewardClaims,
    cdpTransactions: cdpTxs,
    evmTransactions: evmTxs,
    assets: Array.from(assets),
  };
}
