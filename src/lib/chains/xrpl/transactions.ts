// XRPL Transaction Normalizer

import type {
  NormalizedTransaction,
  TransactionType,
  AwakenTag,
} from "@/lib/types";
import {
  type XRPLTransaction,
  type XRPLAmountValue,
  XRPL_TX_DESCRIPTIONS,
} from "./types";
import {
  rippleTimeToDate,
  parseAmount,
  dropsToXRP,
  fetchXRPPrice,
  getUniqueDates,
  decodeMemo,
  formatCurrencyCode,
} from "./api";

// Map XRPL transaction types to internal types
function getTransactionType(
  tx: XRPLTransaction,
  address: string
): TransactionType {
  switch (tx.TransactionType) {
    case "Payment":
      if (tx.Account === address) {
        return "transfer_sent";
      }
      return "transfer_received";

    case "OfferCreate":
    case "OfferCancel":
      return "swap";

    case "TrustSet":
      return "approve";

    case "NFTokenMint":
      return "mint";

    case "NFTokenBurn":
      return "burn";

    case "NFTokenAcceptOffer":
      // Check if we're the buyer or seller
      return "swap";

    case "NFTokenCreateOffer":
    case "NFTokenCancelOffer":
      return "approve";

    case "AMMCreate":
    case "AMMDeposit":
      return "liquidity_add";

    case "AMMWithdraw":
      return "liquidity_remove";

    case "AMMVote":
    case "AMMBid":
    case "AMMDelete":
      return "approve";

    case "EscrowCreate":
    case "PaymentChannelCreate":
    case "PaymentChannelFund":
      return "stake";

    case "EscrowFinish":
    case "EscrowCancel":
    case "PaymentChannelClaim":
      return "unstake";

    case "CheckCreate":
    case "CheckCancel":
      return "approve";

    case "CheckCash":
      return "transfer_received";

    case "AccountSet":
    case "SetRegularKey":
    case "SignerListSet":
    case "DepositPreauth":
    case "AccountDelete":
      return "approve";

    case "Clawback":
      return "burn";

    default:
      return "transfer_sent";
  }
}

// Map transaction types to Awaken tags
function getAwakenTag(tx: XRPLTransaction, address: string): AwakenTag {
  switch (tx.TransactionType) {
    case "Payment":
      if (tx.Account === address) {
        return "payment";
      }
      return "receive";

    case "OfferCreate":
      return "trade";

    case "OfferCancel":
      return "payment"; // No tax event, but we track fee

    case "TrustSet":
      return "payment"; // No tax event, but we track fee

    case "NFTokenMint":
      return "receive"; // Minting is receiving

    case "NFTokenBurn":
      return "lost";

    case "NFTokenAcceptOffer":
      return "trade";

    case "NFTokenCreateOffer":
    case "NFTokenCancelOffer":
      return "payment"; // Track fee

    case "AMMCreate":
    case "AMMDeposit":
      return "payment"; // Sending to LP

    case "AMMWithdraw":
      return "receive"; // Receiving from LP

    case "AMMVote":
    case "AMMBid":
    case "AMMDelete":
      return "payment"; // Track fee

    case "EscrowCreate":
      return "staking_deposit";

    case "EscrowFinish":
      return "unstaking_withdraw";

    case "EscrowCancel":
      return "unstaking_withdraw";

    case "PaymentChannelCreate":
    case "PaymentChannelFund":
      return "staking_deposit";

    case "PaymentChannelClaim":
      return "receive";

    case "CheckCreate":
    case "CheckCancel":
      return "payment"; // Track fee

    case "CheckCash":
      return "receive";

    case "AccountSet":
    case "SetRegularKey":
    case "SignerListSet":
    case "DepositPreauth":
      return "payment"; // Track fee

    case "AccountDelete":
      return "payment"; // Remaining XRP sent out

    case "Clawback":
      return "lost";

    default:
      return "payment";
  }
}

// Extract sent/received amounts from transaction
function extractAmounts(
  tx: XRPLTransaction,
  address: string
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

  switch (tx.TransactionType) {
    case "Payment": {
      // Get delivered amount from metadata for accurate value
      const deliveredAmount =
        tx.meta?.delivered_amount || tx.Amount;

      if (deliveredAmount) {
        const parsed = parseAmount(deliveredAmount as XRPLAmountValue);

        if (tx.Account === address) {
          // We sent this payment
          sentAmount = parsed.value;
          sentCurrency = formatCurrencyCode(parsed.currency);
        } else if (tx.Destination === address) {
          // We received this payment
          receivedAmount = parsed.value;
          receivedCurrency = formatCurrencyCode(parsed.currency);
        }
      }
      break;
    }

    case "OfferCreate": {
      // DEX trade - TakerGets is what we're selling, TakerPays is what we're buying
      if (tx.TakerGets) {
        const gets = parseAmount(tx.TakerGets);
        sentAmount = gets.value;
        sentCurrency = formatCurrencyCode(gets.currency);
      }
      if (tx.TakerPays) {
        const pays = parseAmount(tx.TakerPays);
        receivedAmount = pays.value;
        receivedCurrency = formatCurrencyCode(pays.currency);
      }
      break;
    }

    case "AMMDeposit": {
      // Depositing assets to AMM
      if (tx.Amount) {
        const amount = parseAmount(tx.Amount);
        sentAmount = amount.value;
        sentCurrency = formatCurrencyCode(amount.currency);
      }
      if (tx.LPTokenOut) {
        receivedAmount = parseFloat(tx.LPTokenOut.value);
        receivedCurrency = "LP-TOKEN";
      }
      break;
    }

    case "AMMWithdraw": {
      // Withdrawing from AMM
      if (tx.LPTokenIn) {
        sentAmount = parseFloat(tx.LPTokenIn.value);
        sentCurrency = "LP-TOKEN";
      }
      if (tx.Amount) {
        const amount = parseAmount(tx.Amount);
        receivedAmount = amount.value;
        receivedCurrency = formatCurrencyCode(amount.currency);
      }
      break;
    }

    case "EscrowCreate":
    case "PaymentChannelCreate":
    case "PaymentChannelFund": {
      if (tx.Amount) {
        const amount = parseAmount(tx.Amount);
        sentAmount = amount.value;
        sentCurrency = formatCurrencyCode(amount.currency);
      }
      break;
    }

    case "EscrowFinish":
    case "PaymentChannelClaim": {
      // Check metadata for actual amounts released
      if (tx.meta?.delivered_amount) {
        const amount = parseAmount(tx.meta.delivered_amount as XRPLAmountValue);
        receivedAmount = amount.value;
        receivedCurrency = formatCurrencyCode(amount.currency);
      } else if (tx.Amount) {
        const amount = parseAmount(tx.Amount);
        receivedAmount = amount.value;
        receivedCurrency = formatCurrencyCode(amount.currency);
      }
      break;
    }

    case "CheckCash": {
      if (tx.Amount) {
        const amount = parseAmount(tx.Amount);
        receivedAmount = amount.value;
        receivedCurrency = formatCurrencyCode(amount.currency);
      }
      break;
    }

    case "NFTokenAcceptOffer": {
      // NFT trade - this is complex, simplified handling
      if (tx.NFTokenBrokerFee) {
        const fee = parseAmount(tx.NFTokenBrokerFee);
        sentAmount = fee.value;
        sentCurrency = formatCurrencyCode(fee.currency);
      }
      break;
    }

    case "Clawback": {
      if (tx.Amount) {
        const amount = parseAmount(tx.Amount);
        sentAmount = amount.value;
        sentCurrency = formatCurrencyCode(amount.currency);
      }
      break;
    }
  }

  return { sentAmount, sentCurrency, receivedAmount, receivedCurrency };
}

// Process a single transaction
function processTransaction(
  tx: XRPLTransaction,
  address: string,
  xrpPrices: Map<string, number>
): NormalizedTransaction {
  const timestamp = rippleTimeToDate(tx.date);
  const dateStr = timestamp.toISOString().split("T")[0];
  const xrpPrice = xrpPrices.get(dateStr);

  const type = getTransactionType(tx, address);
  const tag = getAwakenTag(tx, address);
  const fee = dropsToXRP(tx.Fee);

  const { sentAmount, sentCurrency, receivedAmount, receivedCurrency } =
    extractAmounts(tx, address);

  // Extract memo if present
  let notes = XRPL_TX_DESCRIPTIONS[tx.TransactionType] || tx.TransactionType;
  if (tx.Memos && tx.Memos.length > 0) {
    const memoData = decodeMemo(tx.Memos[0].Memo.MemoData);
    if (memoData) {
      notes = `${notes} | ${memoData}`;
    }
  }

  return {
    id: tx.hash,
    type,
    timestamp,
    sentAmount,
    sentCurrency,
    receivedAmount,
    receivedCurrency,
    feeAmount: tx.Account === address ? fee : 0, // Only count fee if we initiated
    feeCurrency: "XRP",
    transactionHash: tx.hash,
    notes,
    tag,
    fiatPrice: xrpPrice,
  };
}

// Main function to normalize all transactions
export async function normalizeXRPLTransactions(
  transactions: XRPLTransaction[],
  address: string,
  onProgress?: (message: string) => void
): Promise<NormalizedTransaction[]> {
  if (transactions.length === 0) {
    return [];
  }

  onProgress?.("Fetching historical XRP prices...");

  // Fetch XRP prices for unique dates (limit to 30 to avoid rate limiting)
  const uniqueDates = getUniqueDates(transactions);
  const xrpPrices = new Map<string, number>();
  const datesToFetch = uniqueDates.slice(0, 30);

  for (const dateStr of datesToFetch) {
    const [year, month, day] = dateStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const price = await fetchXRPPrice(date);
    if (price !== null) {
      xrpPrices.set(dateStr, price);
    }
  }

  onProgress?.("Processing transactions...");

  // Process all transactions
  const normalizedTxs: NormalizedTransaction[] = [];

  for (const tx of transactions) {
    const normalized = processTransaction(tx, address, xrpPrices);
    normalizedTxs.push(normalized);
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

  let payments = 0;
  let trades = 0;
  let nftTxs = 0;

  for (const tx of transactions) {
    if (tx.receivedCurrency) {
      assets.add(tx.receivedCurrency);
      if (tx.receivedCurrency === "XRP" && tx.receivedAmount) {
        totalReceived += tx.receivedAmount;
      }
    }

    if (tx.sentCurrency) {
      assets.add(tx.sentCurrency);
      if (tx.sentCurrency === "XRP" && tx.sentAmount) {
        totalSent += tx.sentAmount;
      }
    }

    if (tx.feeAmount && tx.feeCurrency === "XRP") {
      totalFees += tx.feeAmount;
    }

    // Count transaction types
    if (tx.tag === "payment" || tx.tag === "receive") {
      payments++;
    }
    if (tx.tag === "trade") {
      trades++;
    }
    if (tx.notes.includes("NFT")) {
      nftTxs++;
    }
  }

  return {
    totalTransactions: transactions.length,
    totalReceived,
    totalSent,
    totalFees,
    payments,
    trades,
    nftTransactions: nftTxs,
    assets: Array.from(assets),
  };
}
