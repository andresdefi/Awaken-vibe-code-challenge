import type {
  NormalizedTransaction,
  TransactionType,
  AwakenTag,
} from "@/lib/types";
import type {
  MoralisTransaction,
  MoralisCategory,
  MoralisTokenTransfer,
  MoralisNftTransferItem,
} from "./types";
import { weiToRon, convertTokenAmount, normalizeRoninAddress, isStakingContract } from "./utils";

/**
 * Map Moralis category to our transaction type
 */
function getCategoryTransactionType(category: MoralisCategory, address: string, toAddress: string): TransactionType {
  // Check if this is a staking transaction
  const isStaking = isStakingContract(toAddress);

  switch (category) {
    case "send":
      return isStaking ? "stake" : "transfer_sent";
    case "receive":
      return "transfer_received";
    case "token send":
      return "token_sent";
    case "token receive":
      return "token_received";
    case "nft send":
      return "nft_sent";
    case "nft receive":
      return "nft_received";
    case "token swap":
      return "swap";
    case "deposit":
      return "stake";
    case "withdraw":
      return "unstake";
    case "airdrop":
      return "airdrop";
    case "mint":
      return "mint";
    case "burn":
      return "burn";
    case "nft purchase":
      return "nft_purchase";
    case "nft sale":
      return "nft_sale";
    case "approve":
    case "revoke":
      return "approve";
    case "borrow":
    case "contract interaction":
    default:
      return "transfer_sent";
  }
}

/**
 * Map transaction type to Awaken tag
 */
function getTagForType(type: TransactionType): AwakenTag {
  switch (type) {
    case "transfer_sent":
    case "token_sent":
      return "payment";
    case "transfer_received":
    case "token_received":
      return "receive";
    case "nft_sent":
      return "gift_sent";
    case "nft_received":
      return "gift_received";
    case "nft_purchase":
      return "payment";
    case "nft_sale":
      return "receive";
    case "swap":
      return "trade";
    case "stake":
    case "bond":
    case "liquidity_add":
      return "staking_deposit";
    case "unstake":
    case "unbond":
    case "liquidity_remove":
      return "unstaking_withdraw";
    case "emission_reward":
      return "claim_rewards";
    case "airdrop":
      return "airdrop";
    case "slash":
    case "burn":
      return "lost";
    case "mint":
      return "receive";
    case "approve":
      // Approvals don't have value, we might skip them
      return "payment";
    default:
      return "payment";
  }
}

/**
 * Normalize a Moralis wallet history transaction
 */
export function normalizeWalletHistoryTx(
  tx: MoralisTransaction,
  walletAddress: string,
  priceMap: Map<string, number>
): NormalizedTransaction | NormalizedTransaction[] | null {
  const normalizedWallet = normalizeRoninAddress(walletAddress).toLowerCase();
  const timestamp = new Date(tx.block_timestamp);
  const dateKey = timestamp.toISOString().split("T")[0];
  const ronPrice = priceMap.get(dateKey);

  // Skip spam transactions
  if (tx.possible_spam) {
    return null;
  }

  // Skip failed transactions
  if (tx.receipt_status !== "1") {
    return null;
  }

  // Calculate fee (always paid by sender in RON)
  const fee = weiToRon(tx.transaction_fee || "0");
  const isSender = tx.from_address.toLowerCase() === normalizedWallet;

  // Handle swaps - these have both sent and received tokens
  if (tx.category === "token swap" && tx.erc20_transfers.length >= 2) {
    return normalizeSwapTransaction(tx, normalizedWallet, timestamp, fee, priceMap);
  }

  // Handle NFT purchases/sales
  if ((tx.category === "nft purchase" || tx.category === "nft sale") && tx.nft_transfers.length > 0) {
    return normalizeNftTransaction(tx, normalizedWallet, timestamp, fee, priceMap);
  }

  // Determine transaction type
  const type = getCategoryTransactionType(tx.category, normalizedWallet, tx.to_address);

  // Handle native transfers
  if (tx.native_transfers.length > 0 && tx.erc20_transfers.length === 0) {
    const nativeTransfer = tx.native_transfers.find(
      (nt) => nt.from_address.toLowerCase() === normalizedWallet || nt.to_address.toLowerCase() === normalizedWallet
    );

    if (nativeTransfer) {
      const amount = weiToRon(nativeTransfer.value);
      const isOutgoing = nativeTransfer.direction === "send";

      return {
        id: `${tx.hash}-native`,
        type: isOutgoing ? (isStakingContract(tx.to_address) ? "stake" : "transfer_sent") : "transfer_received",
        timestamp,
        sentAmount: isOutgoing ? amount : null,
        sentCurrency: isOutgoing ? "RON" : null,
        receivedAmount: isOutgoing ? null : amount,
        receivedCurrency: isOutgoing ? null : "RON",
        feeAmount: isSender ? fee : 0,
        feeCurrency: "RON",
        transactionHash: tx.hash,
        notes: tx.summary || (isOutgoing ? "RON transfer out" : "RON transfer in"),
        tag: getTagForType(isOutgoing ? "transfer_sent" : "transfer_received"),
        fiatPrice: ronPrice,
      };
    }
  }

  // Handle token transfers
  if (tx.erc20_transfers.length > 0) {
    const results: NormalizedTransaction[] = [];

    for (const transfer of tx.erc20_transfers) {
      // Skip spam tokens
      if (transfer.possible_spam) continue;

      const amount = parseFloat(transfer.value_formatted || "0");
      const isOutgoing = transfer.direction === "send";
      const symbol = transfer.token_symbol || "UNKNOWN";

      results.push({
        id: `${tx.hash}-erc20-${transfer.log_index}`,
        type: isOutgoing ? "token_sent" : "token_received",
        timestamp,
        sentAmount: isOutgoing ? amount : null,
        sentCurrency: isOutgoing ? symbol : null,
        receivedAmount: isOutgoing ? null : amount,
        receivedCurrency: isOutgoing ? null : symbol,
        feeAmount: isSender && results.length === 0 ? fee : 0, // Only first transfer gets the fee
        feeCurrency: "RON",
        transactionHash: tx.hash,
        notes: `${symbol} ${isOutgoing ? "sent" : "received"}`,
        tag: getTagForType(isOutgoing ? "token_sent" : "token_received"),
        fiatPrice: ronPrice,
      });
    }

    return results.length > 0 ? results : null;
  }

  // Handle NFT transfers (non-purchase/sale)
  if (tx.nft_transfers.length > 0) {
    const results: NormalizedTransaction[] = [];

    for (const nft of tx.nft_transfers) {
      if (nft.possible_spam) continue;

      const isOutgoing = nft.direction === "send";
      const nftName = nft.normalized_metadata?.name || `NFT #${nft.token_id}`;

      results.push({
        id: `${tx.hash}-nft-${nft.log_index}`,
        type: isOutgoing ? "nft_sent" : "nft_received",
        timestamp,
        sentAmount: isOutgoing ? 1 : null,
        sentCurrency: isOutgoing ? nftName : null,
        receivedAmount: isOutgoing ? null : 1,
        receivedCurrency: isOutgoing ? null : nftName,
        feeAmount: isSender && results.length === 0 ? fee : 0,
        feeCurrency: "RON",
        transactionHash: tx.hash,
        notes: `NFT ${isOutgoing ? "sent" : "received"}: ${nftName}`,
        tag: getTagForType(isOutgoing ? "nft_sent" : "nft_received"),
        fiatPrice: ronPrice,
      });
    }

    return results.length > 0 ? results : null;
  }

  // Handle contract interactions with value
  const value = weiToRon(tx.value);
  if (value > 0) {
    const isOutgoing = isSender;

    return {
      id: `${tx.hash}-value`,
      type: isOutgoing ? type : "transfer_received",
      timestamp,
      sentAmount: isOutgoing ? value : null,
      sentCurrency: isOutgoing ? "RON" : null,
      receivedAmount: isOutgoing ? null : value,
      receivedCurrency: isOutgoing ? null : "RON",
      feeAmount: isSender ? fee : 0,
      feeCurrency: "RON",
      transactionHash: tx.hash,
      notes: tx.summary || tx.method_label || "Contract interaction",
      tag: getTagForType(type),
      fiatPrice: ronPrice,
    };
  }

  // Skip zero-value contract interactions (approvals, etc.)
  return null;
}

/**
 * Normalize a swap transaction (has both sent and received tokens)
 */
function normalizeSwapTransaction(
  tx: MoralisTransaction,
  walletAddress: string,
  timestamp: Date,
  fee: number,
  priceMap: Map<string, number>
): NormalizedTransaction | null {
  const dateKey = timestamp.toISOString().split("T")[0];
  const ronPrice = priceMap.get(dateKey);

  // Find sent and received tokens
  const sentTransfer = tx.erc20_transfers.find((t) => t.direction === "send" && !t.possible_spam);
  const receivedTransfer = tx.erc20_transfers.find((t) => t.direction === "receive" && !t.possible_spam);

  if (!sentTransfer || !receivedTransfer) {
    return null;
  }

  const sentAmount = parseFloat(sentTransfer.value_formatted || "0");
  const receivedAmount = parseFloat(receivedTransfer.value_formatted || "0");

  return {
    id: `${tx.hash}-swap`,
    type: "swap",
    timestamp,
    sentAmount,
    sentCurrency: sentTransfer.token_symbol,
    receivedAmount,
    receivedCurrency: receivedTransfer.token_symbol,
    feeAmount: fee,
    feeCurrency: "RON",
    transactionHash: tx.hash,
    notes: `Swapped ${sentTransfer.token_symbol} for ${receivedTransfer.token_symbol}`,
    tag: "trade",
    fiatPrice: ronPrice,
  };
}

/**
 * Normalize NFT purchase/sale transaction
 */
function normalizeNftTransaction(
  tx: MoralisTransaction,
  walletAddress: string,
  timestamp: Date,
  fee: number,
  priceMap: Map<string, number>
): NormalizedTransaction | null {
  const dateKey = timestamp.toISOString().split("T")[0];
  const ronPrice = priceMap.get(dateKey);

  const nft = tx.nft_transfers[0];
  if (!nft || nft.possible_spam) return null;

  const isPurchase = tx.category === "nft purchase";
  const nftName = nft.normalized_metadata?.name || `NFT #${nft.token_id}`;

  // Find payment (native RON or ERC20)
  let paymentAmount = 0;
  let paymentCurrency = "RON";

  if (tx.native_transfers.length > 0) {
    const payment = tx.native_transfers[0];
    paymentAmount = weiToRon(payment.value);
    paymentCurrency = "RON";
  } else if (tx.erc20_transfers.length > 0) {
    const payment = tx.erc20_transfers.find((t) =>
      isPurchase ? t.direction === "send" : t.direction === "receive"
    );
    if (payment) {
      paymentAmount = parseFloat(payment.value_formatted || "0");
      paymentCurrency = payment.token_symbol;
    }
  }

  if (isPurchase) {
    return {
      id: `${tx.hash}-nft-purchase`,
      type: "nft_purchase",
      timestamp,
      sentAmount: paymentAmount,
      sentCurrency: paymentCurrency,
      receivedAmount: 1,
      receivedCurrency: nftName,
      feeAmount: fee,
      feeCurrency: "RON",
      transactionHash: tx.hash,
      notes: `Purchased NFT: ${nftName}`,
      tag: "payment",
      fiatPrice: ronPrice,
    };
  } else {
    return {
      id: `${tx.hash}-nft-sale`,
      type: "nft_sale",
      timestamp,
      sentAmount: 1,
      sentCurrency: nftName,
      receivedAmount: paymentAmount,
      receivedCurrency: paymentCurrency,
      feeAmount: fee,
      feeCurrency: "RON",
      transactionHash: tx.hash,
      notes: `Sold NFT: ${nftName}`,
      tag: "receive",
      fiatPrice: ronPrice,
    };
  }
}

/**
 * Normalize standalone token transfer (from token transfers endpoint)
 */
export function normalizeTokenTransfer(
  transfer: MoralisTokenTransfer,
  walletAddress: string,
  priceMap: Map<string, number>
): NormalizedTransaction | null {
  const normalizedWallet = normalizeRoninAddress(walletAddress).toLowerCase();

  // Skip spam
  if (transfer.possible_spam) return null;

  const timestamp = new Date(transfer.block_timestamp);
  const dateKey = timestamp.toISOString().split("T")[0];
  const ronPrice = priceMap.get(dateKey);

  const isSent = transfer.from_address.toLowerCase() === normalizedWallet;
  const decimals = parseInt(transfer.token_decimals || "18");
  const amount = convertTokenAmount(transfer.value, decimals);
  const symbol = transfer.token_symbol || "UNKNOWN";

  return {
    id: `token-${transfer.transaction_hash}-${transfer.log_index}`,
    type: isSent ? "token_sent" : "token_received",
    timestamp,
    sentAmount: isSent ? amount : null,
    sentCurrency: isSent ? symbol : null,
    receivedAmount: isSent ? null : amount,
    receivedCurrency: isSent ? null : symbol,
    feeAmount: 0, // Fee included in wallet history
    feeCurrency: "RON",
    transactionHash: transfer.transaction_hash,
    notes: `${symbol} ${isSent ? "sent" : "received"}`,
    tag: isSent ? "payment" : "receive",
    fiatPrice: ronPrice,
  };
}

/**
 * Normalize NFT transfer (from NFT transfers endpoint)
 */
export function normalizeNftTransfer(
  transfer: MoralisNftTransferItem,
  walletAddress: string,
  priceMap: Map<string, number>
): NormalizedTransaction | null {
  const normalizedWallet = normalizeRoninAddress(walletAddress).toLowerCase();

  // Skip spam
  if (transfer.possible_spam) return null;

  const timestamp = new Date(transfer.block_timestamp);
  const dateKey = timestamp.toISOString().split("T")[0];
  const ronPrice = priceMap.get(dateKey);

  const isSent = transfer.from_address.toLowerCase() === normalizedWallet;
  const nftId = `NFT #${transfer.token_id}`;
  const amount = parseInt(transfer.amount || "1");

  return {
    id: `nft-${transfer.transaction_hash}-${transfer.log_index}`,
    type: isSent ? "nft_sent" : "nft_received",
    timestamp,
    sentAmount: isSent ? amount : null,
    sentCurrency: isSent ? nftId : null,
    receivedAmount: isSent ? null : amount,
    receivedCurrency: isSent ? null : nftId,
    feeAmount: 0,
    feeCurrency: "RON",
    transactionHash: transfer.transaction_hash,
    notes: `NFT ${isSent ? "sent" : "received"}: ${nftId}`,
    tag: isSent ? "gift_sent" : "gift_received",
    fiatPrice: ronPrice,
  };
}

/**
 * Merge and deduplicate transactions from multiple sources
 */
export function mergeAndSortTransactions(
  ...transactionArrays: (NormalizedTransaction | NormalizedTransaction[] | null)[][]
): NormalizedTransaction[] {
  const all: NormalizedTransaction[] = [];

  for (const arr of transactionArrays) {
    for (const item of arr) {
      if (item === null) continue;
      if (Array.isArray(item)) {
        all.push(...item);
      } else {
        all.push(item);
      }
    }
  }

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
