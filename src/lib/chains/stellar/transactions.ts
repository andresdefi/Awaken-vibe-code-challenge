// Stellar Transaction Normalizer

import type {
  NormalizedTransaction,
  TransactionType,
  AwakenTag,
} from "@/lib/types";
import {
  type StellarOperation,
  STELLAR_OP_DESCRIPTIONS,
} from "./types";
import {
  parseAmount,
  stroopsToXLM,
  fetchXLMPrice,
  fetchTransactionDetails,
  getUniqueDates,
  getAssetName,
} from "./api";

// Map Stellar operation types to internal types
function getTransactionType(
  op: StellarOperation,
  address: string
): TransactionType {
  switch (op.type) {
    case "payment":
    case "path_payment_strict_receive":
    case "path_payment_strict_send":
      if (op.from === address || op.source_account === address) {
        return "transfer_sent";
      }
      return "transfer_received";

    case "create_account":
      if (op.funder === address || op.source_account === address) {
        return "transfer_sent";
      }
      return "transfer_received";

    case "account_merge":
      if (op.source_account === address) {
        return "transfer_sent";
      }
      return "transfer_received";

    case "manage_sell_offer":
    case "manage_buy_offer":
    case "create_passive_sell_offer":
      return "swap";

    case "change_trust":
    case "allow_trust":
    case "set_trust_line_flags":
      return "approve";

    case "liquidity_pool_deposit":
      return "liquidity_add";

    case "liquidity_pool_withdraw":
      return "liquidity_remove";

    case "create_claimable_balance":
      return "stake";

    case "claim_claimable_balance":
      return "unstake";

    case "inflation":
      return "emission_reward";

    case "set_options":
    case "manage_data":
    case "bump_sequence":
    case "begin_sponsoring_future_reserves":
    case "end_sponsoring_future_reserves":
    case "revoke_sponsorship":
    case "invoke_host_function":
    case "extend_footprint_ttl":
    case "restore_footprint":
      return "approve";

    default:
      return "transfer_sent";
  }
}

// Map operation types to Awaken tags
function getAwakenTag(op: StellarOperation, address: string): AwakenTag {
  switch (op.type) {
    case "payment":
    case "path_payment_strict_receive":
    case "path_payment_strict_send":
      if (op.from === address || op.source_account === address) {
        return "payment";
      }
      return "receive";

    case "create_account":
      if (op.funder === address || op.source_account === address) {
        return "payment";
      }
      return "receive";

    case "account_merge":
      if (op.source_account === address) {
        return "payment";
      }
      return "receive";

    case "manage_sell_offer":
    case "manage_buy_offer":
    case "create_passive_sell_offer":
      return "trade";

    case "change_trust":
    case "allow_trust":
    case "set_trust_line_flags":
      return "payment"; // Track fee only

    case "liquidity_pool_deposit":
      return "payment"; // Sending to LP

    case "liquidity_pool_withdraw":
      return "receive"; // Receiving from LP

    case "create_claimable_balance":
      return "staking_deposit";

    case "claim_claimable_balance":
      return "receive";

    case "inflation":
      return "claim_rewards";

    case "set_options":
    case "manage_data":
    case "bump_sequence":
    case "begin_sponsoring_future_reserves":
    case "end_sponsoring_future_reserves":
    case "revoke_sponsorship":
    case "invoke_host_function":
    case "extend_footprint_ttl":
    case "restore_footprint":
      return "payment"; // Track fee only

    default:
      return "payment";
  }
}

// Extract sent/received amounts from operation
function extractAmounts(
  op: StellarOperation,
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

  switch (op.type) {
    case "payment": {
      const amount = op.amount ? parseAmount(op.amount) : null;
      const currency = getAssetName(op.asset_type, op.asset_code);

      if (op.from === address || op.source_account === address) {
        sentAmount = amount;
        sentCurrency = currency;
      } else if (op.to === address) {
        receivedAmount = amount;
        receivedCurrency = currency;
      }
      break;
    }

    case "path_payment_strict_receive":
    case "path_payment_strict_send": {
      // Path payments: source sends one asset, destination receives another
      if (op.from === address || op.source_account === address) {
        // We sent the source asset
        sentAmount = op.source_amount ? parseAmount(op.source_amount) : null;
        sentCurrency = getAssetName(op.source_asset_type, op.source_asset_code);
      }
      if (op.to === address) {
        // We received the destination asset
        receivedAmount = op.amount ? parseAmount(op.amount) : null;
        receivedCurrency = getAssetName(op.asset_type, op.asset_code);
      }
      break;
    }

    case "create_account": {
      const amount = op.starting_balance ? parseAmount(op.starting_balance) : null;

      if (op.funder === address || op.source_account === address) {
        sentAmount = amount;
        sentCurrency = "XLM";
      } else if (op.account === address) {
        receivedAmount = amount;
        receivedCurrency = "XLM";
      }
      break;
    }

    case "account_merge": {
      // When merging, the source account's XLM goes to the destination
      // Amount comes from the result, but we don't have it in the operation
      // Mark as a merge event
      if (op.source_account === address) {
        sentAmount = null; // Amount not available in operation
        sentCurrency = "XLM";
      } else if (op.into === address) {
        receivedAmount = null; // Amount not available in operation
        receivedCurrency = "XLM";
      }
      break;
    }

    case "manage_sell_offer":
    case "manage_buy_offer":
    case "create_passive_sell_offer": {
      // DEX offers - selling one asset for another
      if (op.amount) {
        sentAmount = parseAmount(op.amount);
        sentCurrency = getAssetName(op.selling_asset_type, op.selling_asset_code);
      }
      // For offers, we set up what we're buying (but execution is separate)
      if (op.price && op.amount) {
        const buyAmount = parseAmount(op.amount) * parseFloat(op.price);
        receivedAmount = buyAmount;
        receivedCurrency = getAssetName(op.buying_asset_type, op.buying_asset_code);
      }
      break;
    }

    case "liquidity_pool_deposit": {
      // Depositing assets to LP, receiving shares
      if (op.reserves_deposited && op.reserves_deposited.length > 0) {
        // Take the first deposited asset
        const firstDeposit = op.reserves_deposited[0];
        sentAmount = parseAmount(firstDeposit.amount);
        sentCurrency = firstDeposit.asset === "native" ? "XLM" : firstDeposit.asset;
      }
      if (op.shares_received) {
        receivedAmount = parseAmount(op.shares_received);
        receivedCurrency = "LP-SHARES";
      }
      break;
    }

    case "liquidity_pool_withdraw": {
      // Burning shares, receiving assets
      if (op.shares) {
        sentAmount = parseAmount(op.shares);
        sentCurrency = "LP-SHARES";
      }
      if (op.reserves_received && op.reserves_received.length > 0) {
        const firstReceived = op.reserves_received[0];
        receivedAmount = parseAmount(firstReceived.amount);
        receivedCurrency = firstReceived.asset === "native" ? "XLM" : firstReceived.asset;
      }
      break;
    }

    case "create_claimable_balance": {
      if (op.amount) {
        sentAmount = parseAmount(op.amount);
        sentCurrency = getAssetName(op.asset_type, op.asset_code);
      }
      break;
    }

    case "claim_claimable_balance": {
      // The claimed amount comes from the balance itself, not the operation
      // We'd need to look up the balance to get the exact amount
      receivedCurrency = "XLM"; // Default, could be any asset
      break;
    }

    case "change_trust": {
      // No value transfer, just trustline setup
      break;
    }
  }

  return { sentAmount, sentCurrency, receivedAmount, receivedCurrency };
}

// Process a single operation
async function processOperation(
  op: StellarOperation,
  address: string,
  xlmPrices: Map<string, number>,
  txFees: Map<string, number>
): Promise<NormalizedTransaction> {
  const timestamp = new Date(op.created_at);
  const dateStr = timestamp.toISOString().split("T")[0];
  const xlmPrice = xlmPrices.get(dateStr);

  const type = getTransactionType(op, address);
  const tag = getAwakenTag(op, address);

  // Get fee from transaction (cached)
  let fee = txFees.get(op.transaction_hash) || 0;

  const { sentAmount, sentCurrency, receivedAmount, receivedCurrency } =
    extractAmounts(op, address);

  // Build notes
  let notes = STELLAR_OP_DESCRIPTIONS[op.type] || op.type;

  return {
    id: op.id,
    type,
    timestamp,
    sentAmount,
    sentCurrency,
    receivedAmount,
    receivedCurrency,
    feeAmount: op.source_account === address ? fee : 0, // Only count fee if we initiated
    feeCurrency: "XLM",
    transactionHash: op.transaction_hash,
    notes,
    tag,
    fiatPrice: xlmPrice,
  };
}

// Main function to normalize all operations
export async function normalizeStellarOperations(
  operations: StellarOperation[],
  address: string,
  onProgress?: (message: string) => void
): Promise<NormalizedTransaction[]> {
  if (operations.length === 0) {
    return [];
  }

  onProgress?.("Fetching transaction fees...");

  // Fetch transaction details to get fees (batch unique transactions)
  const uniqueTxHashes = [...new Set(operations.map((op) => op.transaction_hash))];
  const txFees = new Map<string, number>();

  // Limit fee fetching to avoid too many requests
  const hashesToFetch = uniqueTxHashes.slice(0, 100);

  for (const hash of hashesToFetch) {
    const txDetails = await fetchTransactionDetails(hash);
    if (txDetails) {
      txFees.set(hash, stroopsToXLM(txDetails.fee_charged));
    }
  }

  onProgress?.("Fetching historical XLM prices...");

  // Fetch XLM prices for unique dates (limit to 30 to avoid rate limiting)
  const uniqueDates = getUniqueDates(operations);
  const xlmPrices = new Map<string, number>();
  const datesToFetch = uniqueDates.slice(0, 30);

  for (const dateStr of datesToFetch) {
    const [year, month, day] = dateStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const price = await fetchXLMPrice(date);
    if (price !== null) {
      xlmPrices.set(dateStr, price);
    }
  }

  onProgress?.("Processing operations...");

  // Process all operations
  const normalizedTxs: NormalizedTransaction[] = [];

  for (const op of operations) {
    const normalized = await processOperation(op, address, xlmPrices, txFees);
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
  let lpTxs = 0;

  for (const tx of transactions) {
    if (tx.receivedCurrency) {
      assets.add(tx.receivedCurrency);
      if (tx.receivedCurrency === "XLM" && tx.receivedAmount) {
        totalReceived += tx.receivedAmount;
      }
    }

    if (tx.sentCurrency) {
      assets.add(tx.sentCurrency);
      if (tx.sentCurrency === "XLM" && tx.sentAmount) {
        totalSent += tx.sentAmount;
      }
    }

    if (tx.feeAmount && tx.feeCurrency === "XLM") {
      totalFees += tx.feeAmount;
    }

    // Count transaction types
    if (tx.tag === "payment" || tx.tag === "receive") {
      payments++;
    }
    if (tx.tag === "trade") {
      trades++;
    }
    if (tx.notes.includes("Liquidity pool")) {
      lpTxs++;
    }
  }

  return {
    totalTransactions: transactions.length,
    totalReceived,
    totalSent,
    totalFees,
    payments,
    trades,
    liquidityPoolTxs: lpTxs,
    assets: Array.from(assets),
  };
}
