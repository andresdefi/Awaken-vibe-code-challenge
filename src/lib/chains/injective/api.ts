// Injective API client using CometBFT RPC and Cosmos LCD endpoints

import type {
  RpcTxSearchResponse,
  LcdTxResponse,
  ProcessedInjTx,
  DenomTrace,
  DelegationResponse,
  UnbondingDelegationResponse,
  RewardsResponse,
  Coin,
  RpcEvent,
} from "./types";

// API endpoints
const RPC_ENDPOINT = "https://sentry.tm.injective.network:443";
const LCD_ENDPOINTS = [
  "https://sentry.lcd.injective.network:443",
  "https://lcd.injective.network",
];
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Rate limiting - conservative for public endpoints
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

/**
 * Fetch with retry and fallback endpoints
 */
async function fetchWithRetry<T>(
  endpoints: string[],
  path: string,
  retries: number = 2
): Promise<T | null> {
  for (const endpoint of endpoints) {
    for (let i = 0; i < retries; i++) {
      try {
        await rateLimiter.waitForSlot();
        const response = await fetch(`${endpoint}${path}`);

        if (response.status === 429) {
          // Rate limited - wait and retry
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${endpoint}${path}:`, error);
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
  }

  return null;
}

/**
 * Fetches transactions for an address using RPC tx_search.
 */
export async function fetchTransactionsByAddress(
  address: string,
  page: number = 1,
  perPage: number = 50
): Promise<{ txs: ProcessedInjTx[]; totalCount: number }> {
  const results: ProcessedInjTx[] = [];
  let totalCount = 0;

  // Search for transactions where address is sender
  const senderQuery = encodeURIComponent(`message.sender='${address}'`);
  await rateLimiter.waitForSlot();

  try {
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
  } catch (error) {
    console.error("Failed to fetch sender transactions:", error);
  }

  // Also search for transactions where address is recipient
  const recipientQuery = encodeURIComponent(`transfer.recipient='${address}'`);
  await rateLimiter.waitForSlot();

  try {
    const recipientResponse = await fetch(
      `${RPC_ENDPOINT}/tx_search?query=${recipientQuery}&page=${page}&per_page=${perPage}&order_by="desc"`
    );

    if (recipientResponse.ok) {
      const recipientData: RpcTxSearchResponse = await recipientResponse.json();

      for (const tx of recipientData.result.txs) {
        // Skip if we already have this tx
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
  } catch (error) {
    console.error("Failed to fetch recipient transactions:", error);
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
  maxTransactions: number = 2000,
  onProgress?: (fetched: number, total: number) => void
): Promise<ProcessedInjTx[]> {
  const allTxs: ProcessedInjTx[] = [];
  const seenHashes = new Set<string>();
  let page = 1;
  const perPage = 50;
  let hasMore = true;

  while (hasMore && allTxs.length < maxTransactions) {
    const { txs, totalCount } = await fetchTransactionsByAddress(address, page, perPage);

    for (const tx of txs) {
      if (!seenHashes.has(tx.hash)) {
        seenHashes.add(tx.hash);
        allTxs.push(tx);
      }
    }

    onProgress?.(allTxs.length, totalCount);

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
 * Processes an RPC transaction into a ProcessedInjTx.
 */
async function processRpcTransaction(
  tx: RpcTxSearchResponse["result"]["txs"][0]
): Promise<ProcessedInjTx | null> {
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
      memo: decodedTx.tx.body.memo,
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
  return fetchWithRetry<LcdTxResponse>(
    LCD_ENDPOINTS,
    `/cosmos/tx/v1beta1/txs/${hash}`
  );
}

/**
 * Fetches delegations for an address.
 */
export async function fetchDelegations(
  address: string
): Promise<DelegationResponse | null> {
  return fetchWithRetry<DelegationResponse>(
    LCD_ENDPOINTS,
    `/cosmos/staking/v1beta1/delegations/${address}`
  );
}

/**
 * Fetches unbonding delegations for an address.
 */
export async function fetchUnbondingDelegations(
  address: string
): Promise<UnbondingDelegationResponse | null> {
  return fetchWithRetry<UnbondingDelegationResponse>(
    LCD_ENDPOINTS,
    `/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`
  );
}

/**
 * Fetches staking rewards for an address.
 */
export async function fetchRewards(
  address: string
): Promise<RewardsResponse | null> {
  return fetchWithRetry<RewardsResponse>(
    LCD_ENDPOINTS,
    `/cosmos/distribution/v1beta1/delegators/${address}/rewards`
  );
}

/**
 * Resolves an IBC denom to its base denom.
 */
export async function resolveIbcDenom(denom: string): Promise<DenomTrace | null> {
  if (!denom.startsWith("ibc/")) {
    return null;
  }

  const hash = denom.replace("ibc/", "");

  return fetchWithRetry<DenomTrace>(
    LCD_ENDPOINTS,
    `/ibc/apps/transfer/v1/denom_traces/${hash}`
  );
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
      const receiver = event.attributes.find((a) =>
        a.key === "receiver" || a.key === "cmVjZWl2ZXI=" // base64 encoded
      )?.value;
      const amount = event.attributes.find((a) =>
        a.key === "amount" || a.key === "YW1vdW50" // base64 encoded
      )?.value;

      const decodedReceiver = tryBase64Decode(receiver);
      if (decodedReceiver === address && amount) {
        const decodedAmount = tryBase64Decode(amount);
        const parsed = parseAmountString(decodedAmount);
        if (parsed) {
          received.push(parsed);
        }
      }
    }

    if (event.type === "coin_spent") {
      const spender = event.attributes.find((a) =>
        a.key === "spender" || a.key === "c3BlbmRlcg==" // base64 encoded
      )?.value;
      const amount = event.attributes.find((a) =>
        a.key === "amount" || a.key === "YW1vdW50" // base64 encoded
      )?.value;

      const decodedSpender = tryBase64Decode(spender);
      if (decodedSpender === address && amount) {
        const decodedAmount = tryBase64Decode(amount);
        const parsed = parseAmountString(decodedAmount);
        if (parsed) {
          sent.push(parsed);
        }
      }
    }
  }

  return { received, sent };
}

/**
 * Try to decode base64, return original if not valid base64
 */
function tryBase64Decode(str: string | undefined): string {
  if (!str) return "";
  try {
    // Check if it looks like base64
    if (/^[A-Za-z0-9+/]+=*$/.test(str)) {
      return Buffer.from(str, "base64").toString("utf-8");
    }
  } catch {
    // Not valid base64
  }
  return str;
}

/**
 * Parses an amount string like "1000inj" into a Coin object.
 */
function parseAmountString(amountStr: string): Coin | null {
  if (!amountStr) return null;

  // Handle format: "1000inj" or "1000ibc/..." or "1000peggy0x..."
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
 * Gets staking rewards from withdraw_rewards events.
 */
export function extractStakingRewards(events: RpcEvent[]): Coin[] {
  const rewards: Coin[] = [];

  for (const event of events) {
    if (event.type === "withdraw_rewards") {
      const amount = event.attributes.find((a) =>
        a.key === "amount" || a.key === "YW1vdW50"
      )?.value;

      if (amount) {
        const decodedAmount = tryBase64Decode(amount);
        const parsed = parseAmountString(decodedAmount);
        if (parsed) {
          rewards.push(parsed);
        }
      }
    }
  }

  return rewards;
}

// Price cache
let priceCache: { data: Map<string, number>; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches INJ price history from CoinGecko.
 */
export async function fetchPriceHistory(
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  // Check cache
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    console.log("Using cached INJ price data");
    return priceCache.data;
  }

  const priceMap = new Map<string, number>();

  // Convert to timestamps
  const start = new Date(startDate).getTime() / 1000;
  const end = new Date(endDate).getTime() / 1000;

  try {
    await rateLimiter.waitForSlot();
    const response = await fetch(
      `${COINGECKO_API}/coins/injective-protocol/market_chart/range?vs_currency=usd&from=${start}&to=${end}`
    );

    if (response.ok) {
      const data = await response.json();
      const prices = data.prices || [];

      for (const [timestamp, price] of prices) {
        const date = new Date(timestamp).toISOString().split("T")[0];
        priceMap.set(date, price);
      }

      priceCache = { data: priceMap, timestamp: now };
      console.log(`Cached ${priceMap.size} price entries for INJ`);
    }
  } catch (error) {
    console.error("Failed to fetch INJ price history:", error);
  }

  return priceMap;
}

/**
 * Fetches INJ price for a specific date.
 */
export async function fetchPriceAtDate(date: string): Promise<number | null> {
  try {
    // Convert YYYY-MM-DD to DD-MM-YYYY for CoinGecko
    const [year, month, day] = date.split("-");
    const cgDate = `${day}-${month}-${year}`;

    await rateLimiter.waitForSlot();
    const response = await fetch(
      `${COINGECKO_API}/coins/injective-protocol/history?date=${cgDate}&localization=false`
    );

    if (response.ok) {
      const data = await response.json();
      return data.market_data?.current_price?.usd || null;
    }
  } catch (error) {
    console.error(`Failed to fetch INJ price for ${date}:`, error);
  }

  return null;
}
