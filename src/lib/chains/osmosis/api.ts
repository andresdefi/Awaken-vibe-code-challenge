// Osmosis API client using CometBFT RPC and Cosmos LCD endpoints

import type {
  RpcTxSearchResponse,
  LcdTxResponse,
  ProcessedOsmoTx,
  DenomTrace,
  AssetMetadata,
  TxMessage,
  RpcEvent,
  Coin,
} from "./types";

// API endpoints
const RPC_ENDPOINT = "https://rpc.osmosis.zone";
const LCD_ENDPOINTS = [
  "https://osmosis-rest.publicnode.com",
  "https://osmosis-api.polkachu.com",
  "https://rest.lavenderfive.com:443/osmosis",
];
const COINGECKO_API = "https://api.coingecko.com/api/v3";
const CHAIN_REGISTRY_ASSETS = "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/assetlist.json";

// Rate limiting
class RateLimiter {
  private lastRequestTime = 0;
  private readonly minInterval: number;

  constructor(requestsPerSecond: number = 2) {
    this.minInterval = 1000 / requestsPerSecond;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }
}

const rateLimiter = new RateLimiter(2);

// Cache for asset metadata
let assetCache: Map<string, AssetMetadata> | null = null;

/**
 * Loads asset metadata from chain-registry.
 */
async function loadAssetMetadata(): Promise<Map<string, AssetMetadata>> {
  if (assetCache) {
    return assetCache;
  }

  try {
    const response = await fetch(CHAIN_REGISTRY_ASSETS);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset list: ${response.status}`);
    }

    const data = await response.json();
    const assets = data.assets || [];

    assetCache = new Map();
    for (const asset of assets) {
      const decimals = asset.denom_units?.find(
        (u: { denom: string; exponent: number }) => u.denom === asset.display
      )?.exponent || 6;

      assetCache.set(asset.base, {
        symbol: asset.symbol || asset.display || "UNKNOWN",
        name: asset.name || asset.symbol || "Unknown",
        decimals,
        coingeckoId: asset.coingecko_id,
        base: asset.base,
      });
    }

    return assetCache;
  } catch (error) {
    console.error("Failed to load asset metadata:", error);
    return new Map();
  }
}

/**
 * Gets asset metadata for a denom.
 */
export async function getAssetMetadata(denom: string): Promise<AssetMetadata | undefined> {
  const assets = await loadAssetMetadata();
  return assets.get(denom);
}

/**
 * Resolves an IBC denom to its base denom using the LCD endpoint.
 */
export async function resolveIbcDenom(denom: string): Promise<DenomTrace | null> {
  if (!denom.startsWith("ibc/")) {
    return null;
  }

  const hash = denom.replace("ibc/", "");

  for (const endpoint of LCD_ENDPOINTS) {
    try {
      await rateLimiter.waitForSlot();
      const response = await fetch(
        `${endpoint}/ibc/apps/transfer/v1/denom_traces/${hash}`
      );

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Try next endpoint
      continue;
    }
  }

  return null;
}

/**
 * Fetches transactions for an address using RPC tx_search.
 * Returns transactions where the address is either sender or recipient.
 */
export async function fetchTransactionsByAddress(
  address: string,
  page: number = 1,
  perPage: number = 100
): Promise<{ txs: ProcessedOsmoTx[]; totalCount: number }> {
  const results: ProcessedOsmoTx[] = [];
  let totalCount = 0;

  // Search for transactions where address is sender
  const senderQuery = encodeURIComponent(`"message.sender='${address}'"`);
  await rateLimiter.waitForSlot();

  const senderResponse = await fetch(
    `${RPC_ENDPOINT}/tx_search?query=${senderQuery}&page=${page}&per_page=${perPage}&order_by="desc"`
  );

  if (senderResponse.ok) {
    const senderData: RpcTxSearchResponse = await senderResponse.json();
    totalCount = parseInt(senderData.result.total_count, 10);

    for (const tx of senderData.result.txs) {
      const processedTx = await processRpcTransaction(tx);
      if (processedTx) {
        results.push(processedTx);
      }
    }
  }

  // Also search for transactions where address is recipient (transfers)
  const recipientQuery = encodeURIComponent(`"transfer.recipient='${address}'"`);
  await rateLimiter.waitForSlot();

  const recipientResponse = await fetch(
    `${RPC_ENDPOINT}/tx_search?query=${recipientQuery}&page=${page}&per_page=${perPage}&order_by="desc"`
  );

  if (recipientResponse.ok) {
    const recipientData: RpcTxSearchResponse = await recipientResponse.json();

    for (const tx of recipientData.result.txs) {
      // Skip if we already have this tx from sender search
      if (results.some((r) => r.hash === tx.hash)) {
        continue;
      }

      const processedTx = await processRpcTransaction(tx);
      if (processedTx) {
        results.push(processedTx);
        totalCount++;
      }
    }
  }

  // Sort by height descending
  results.sort((a, b) => parseInt(b.height, 10) - parseInt(a.height, 10));

  return { txs: results, totalCount };
}

/**
 * Fetches all transactions for an address with pagination.
 */
export async function fetchAllTransactions(
  address: string,
  maxTransactions: number = 5000
): Promise<ProcessedOsmoTx[]> {
  const allTxs: ProcessedOsmoTx[] = [];
  const seenHashes = new Set<string>();
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  while (hasMore && allTxs.length < maxTransactions) {
    const { txs, totalCount } = await fetchTransactionsByAddress(address, page, perPage);

    for (const tx of txs) {
      if (!seenHashes.has(tx.hash)) {
        seenHashes.add(tx.hash);
        allTxs.push(tx);
      }
    }

    // Check if we've fetched all transactions
    if (txs.length < perPage || allTxs.length >= totalCount || allTxs.length >= maxTransactions) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allTxs;
}

/**
 * Processes an RPC transaction into a ProcessedOsmoTx.
 */
async function processRpcTransaction(
  tx: RpcTxSearchResponse["result"]["txs"][0]
): Promise<ProcessedOsmoTx | null> {
  try {
    // Get decoded transaction details from LCD
    const decodedTx = await fetchDecodedTransaction(tx.hash);

    if (!decodedTx) {
      return null;
    }

    return {
      hash: tx.hash,
      height: tx.height,
      timestamp: new Date(decodedTx.tx_response.timestamp),
      messages: decodedTx.tx.body.messages,
      fee: decodedTx.tx.auth_info.fee.amount,
      gasUsed: tx.tx_result.gas_used,
      gasWanted: tx.tx_result.gas_wanted,
      code: tx.tx_result.code,
      events: tx.tx_result.events,
    };
  } catch (error) {
    console.error(`Failed to process transaction ${tx.hash}:`, error);
    return null;
  }
}

/**
 * Fetches a decoded transaction from LCD.
 */
async function fetchDecodedTransaction(hash: string): Promise<LcdTxResponse | null> {
  for (const endpoint of LCD_ENDPOINTS) {
    try {
      await rateLimiter.waitForSlot();
      const response = await fetch(`${endpoint}/cosmos/tx/v1beta1/txs/${hash}`);

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Try next endpoint
      continue;
    }
  }

  return null;
}

/**
 * Gets the block timestamp for a given height.
 */
export async function getBlockTimestamp(height: string): Promise<Date | null> {
  try {
    await rateLimiter.waitForSlot();
    const response = await fetch(`${RPC_ENDPOINT}/block?height=${height}`);

    if (response.ok) {
      const data = await response.json();
      const timestamp = data.result?.block?.header?.time;
      return timestamp ? new Date(timestamp) : null;
    }
  } catch (error) {
    console.error(`Failed to get block timestamp for height ${height}:`, error);
  }

  return null;
}

/**
 * Fetches OSMO price history from CoinGecko.
 */
export async function fetchOsmoPrice(date: string): Promise<number | null> {
  try {
    // Convert YYYY-MM-DD to DD-MM-YYYY for CoinGecko
    const [year, month, day] = date.split("-");
    const cgDate = `${day}-${month}-${year}`;

    await rateLimiter.waitForSlot();
    const response = await fetch(
      `${COINGECKO_API}/coins/osmosis/history?date=${cgDate}&localization=false`
    );

    if (response.ok) {
      const data = await response.json();
      return data.market_data?.current_price?.usd || null;
    }
  } catch (error) {
    console.error(`Failed to fetch OSMO price for ${date}:`, error);
  }

  return null;
}

/**
 * Fetches price history for a date range.
 */
export async function fetchPriceHistory(
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  // Convert to timestamps
  const start = new Date(startDate).getTime() / 1000;
  const end = new Date(endDate).getTime() / 1000;

  try {
    await rateLimiter.waitForSlot();
    const response = await fetch(
      `${COINGECKO_API}/coins/osmosis/market_chart/range?vs_currency=usd&from=${start}&to=${end}`
    );

    if (response.ok) {
      const data = await response.json();
      const prices = data.prices || [];

      for (const [timestamp, price] of prices) {
        const date = new Date(timestamp).toISOString().split("T")[0];
        priceMap.set(date, price);
      }
    }
  } catch (error) {
    console.error("Failed to fetch price history:", error);
  }

  return priceMap;
}

/**
 * Extracts token movements from transaction events.
 */
export function extractTokenMovements(
  events: RpcEvent[],
  address: string
): { received: Coin[]; sent: Coin[] } {
  const received: Coin[] = [];
  const sent: Coin[] = [];

  for (const event of events) {
    if (event.type === "coin_received") {
      const receiver = event.attributes.find((a) => a.key === "receiver")?.value;
      const amount = event.attributes.find((a) => a.key === "amount")?.value;

      if (receiver === address && amount) {
        const parsed = parseAmountString(amount);
        if (parsed) {
          received.push(parsed);
        }
      }
    }

    if (event.type === "coin_spent") {
      const spender = event.attributes.find((a) => a.key === "spender")?.value;
      const amount = event.attributes.find((a) => a.key === "amount")?.value;

      if (spender === address && amount) {
        const parsed = parseAmountString(amount);
        if (parsed) {
          sent.push(parsed);
        }
      }
    }
  }

  return { received, sent };
}

/**
 * Parses an amount string like "1000uosmo" into a Coin object.
 */
function parseAmountString(amountStr: string): Coin | null {
  // Handle format: "1000uosmo" or "1000ibc/..."
  const match = amountStr.match(/^(\d+)(.+)$/);
  if (match) {
    return {
      amount: match[1],
      denom: match[2],
    };
  }
  return null;
}

/**
 * Gets staking rewards from withdraw_delegator_reward events.
 */
export function extractStakingRewards(events: RpcEvent[]): Coin[] {
  const rewards: Coin[] = [];

  for (const event of events) {
    if (event.type === "withdraw_rewards") {
      const amount = event.attributes.find((a) => a.key === "amount")?.value;
      if (amount) {
        const parsed = parseAmountString(amount);
        if (parsed) {
          rewards.push(parsed);
        }
      }
    }
  }

  return rewards;
}
