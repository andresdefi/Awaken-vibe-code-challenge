import type {
  MoralisWalletHistoryResponse,
  MoralisTransaction,
  MoralisTokenTransfersResponse,
  MoralisTokenTransfer,
  MoralisNftTransfersResponse,
  MoralisNftTransferItem,
  CoinGeckoMarketChartResponse,
} from "./types";
import { normalizeRoninAddress } from "./utils";

const MORALIS_API_BASE = "https://deep-index.moralis.io/api/v2.2";
const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
const RONIN_CHAIN = "0x7e4"; // Chain ID 2020 in hex

// Rate limiter for Moralis API
// Free tier: 40 requests/sec, but we'll be conservative
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100;
      if (waitTime > 0) {
        await delay(waitTime);
      }
      this.requests = this.requests.filter((t) => Date.now() - t < this.windowMs);
    }

    this.requests.push(Date.now());
  }
}

// Moralis rate limiter: 25 req/sec (conservative)
const moralisRateLimiter = new RateLimiter(25, 1000);

// CoinGecko rate limiter: 25 req/min for free tier with API key
const coingeckoRateLimiter = new RateLimiter(25, 60000);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMoralisHeaders(): HeadersInit {
  const apiKey = process.env.MORALIS_API_KEY;
  if (!apiKey) {
    throw new Error("MORALIS_API_KEY environment variable is not set");
  }
  return {
    "Accept": "application/json",
    "X-API-Key": apiKey,
  };
}

function getCoinGeckoHeaders(): HeadersInit {
  const apiKey = process.env.COINGECKO_API_KEY;
  const headers: HeadersInit = {
    "Accept": "application/json",
  };
  if (apiKey) {
    headers["x-cg-demo-api-key"] = apiKey;
  }
  return headers;
}

async function fetchMoralisWithRetry<T>(
  endpoint: string,
  retries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      await moralisRateLimiter.waitForSlot();

      const response = await fetch(`${MORALIS_API_BASE}${endpoint}`, {
        method: "GET",
        headers: getMoralisHeaders(),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Moralis rate limited, waiting ${waitTime}ms...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Moralis API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Moralis request failed (attempt ${i + 1}):`, error);
      if (i < retries - 1) {
        await delay(1000 * (i + 1));
      }
    }
  }

  throw lastError || new Error("Failed to fetch from Moralis");
}

/**
 * Fetch wallet history with decoded transactions
 * This is the main endpoint that provides categorized transactions
 */
export async function fetchWalletHistory(
  address: string,
  cursor?: string,
  limit = 100
): Promise<MoralisWalletHistoryResponse> {
  const normalizedAddress = normalizeRoninAddress(address);
  let endpoint = `/wallets/${normalizedAddress}/history?chain=${RONIN_CHAIN}&limit=${limit}`;

  if (cursor) {
    endpoint += `&cursor=${encodeURIComponent(cursor)}`;
  }

  return fetchMoralisWithRetry<MoralisWalletHistoryResponse>(endpoint);
}

/**
 * Fetch all wallet history transactions with pagination
 */
export async function fetchAllWalletHistory(
  address: string,
  onProgress?: (fetched: number, message: string) => void
): Promise<MoralisTransaction[]> {
  const allTransactions: MoralisTransaction[] = [];
  let cursor: string | null = null;
  let page = 0;

  do {
    onProgress?.(allTransactions.length, `Fetching transactions (page ${page + 1})...`);

    const response = await fetchWalletHistory(address, cursor || undefined);
    allTransactions.push(...response.result);
    cursor = response.cursor;
    page++;

    // Safety limit to prevent infinite loops
    if (page > 100) {
      console.warn("Hit pagination safety limit");
      break;
    }
  } while (cursor);

  onProgress?.(allTransactions.length, `Found ${allTransactions.length} transactions`);
  return allTransactions;
}

/**
 * Fetch ERC20 token transfers
 */
export async function fetchTokenTransfers(
  address: string,
  cursor?: string,
  limit = 100
): Promise<MoralisTokenTransfersResponse> {
  const normalizedAddress = normalizeRoninAddress(address);
  let endpoint = `/${normalizedAddress}/erc20/transfers?chain=${RONIN_CHAIN}&limit=${limit}`;

  if (cursor) {
    endpoint += `&cursor=${encodeURIComponent(cursor)}`;
  }

  return fetchMoralisWithRetry<MoralisTokenTransfersResponse>(endpoint);
}

/**
 * Fetch all token transfers with pagination
 */
export async function fetchAllTokenTransfers(
  address: string,
  onProgress?: (fetched: number, message: string) => void
): Promise<MoralisTokenTransfer[]> {
  const allTransfers: MoralisTokenTransfer[] = [];
  let cursor: string | null = null;
  let page = 0;

  do {
    onProgress?.(allTransfers.length, `Fetching token transfers (page ${page + 1})...`);

    const response = await fetchTokenTransfers(address, cursor || undefined);
    allTransfers.push(...response.result);
    cursor = response.cursor;
    page++;

    if (page > 100) {
      console.warn("Hit pagination safety limit for token transfers");
      break;
    }
  } while (cursor);

  return allTransfers;
}

/**
 * Fetch NFT transfers
 */
export async function fetchNftTransfers(
  address: string,
  cursor?: string,
  limit = 100
): Promise<MoralisNftTransfersResponse> {
  const normalizedAddress = normalizeRoninAddress(address);
  let endpoint = `/${normalizedAddress}/nft/transfers?chain=${RONIN_CHAIN}&limit=${limit}&format=decimal`;

  if (cursor) {
    endpoint += `&cursor=${encodeURIComponent(cursor)}`;
  }

  return fetchMoralisWithRetry<MoralisNftTransfersResponse>(endpoint);
}

/**
 * Fetch all NFT transfers with pagination
 */
export async function fetchAllNftTransfers(
  address: string,
  onProgress?: (fetched: number, message: string) => void
): Promise<MoralisNftTransferItem[]> {
  const allTransfers: MoralisNftTransferItem[] = [];
  let cursor: string | null = null;
  let page = 0;

  do {
    onProgress?.(allTransfers.length, `Fetching NFT transfers (page ${page + 1})...`);

    const response = await fetchNftTransfers(address, cursor || undefined);
    allTransfers.push(...response.result);
    cursor = response.cursor;
    page++;

    if (page > 100) {
      console.warn("Hit pagination safety limit for NFT transfers");
      break;
    }
  } while (cursor);

  return allTransfers;
}

// Price cache for CoinGecko
let priceCache: { data: Map<string, number>; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch historical RON prices from CoinGecko
 * Returns a map of date strings (YYYY-MM-DD) to USD prices
 */
export async function fetchPriceHistory(
  fromTimestamp: number,
  toTimestamp: number
): Promise<Map<string, number>> {
  // Check cache
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    console.log("Using cached RON price data");
    return priceCache.data;
  }

  const priceMap = new Map<string, number>();

  try {
    await coingeckoRateLimiter.waitForSlot();

    // CoinGecko uses seconds for timestamps
    const from = Math.floor(fromTimestamp / 1000);
    const to = Math.floor(toTimestamp / 1000);

    const response = await fetch(
      `${COINGECKO_API_BASE}/coins/ronin/market_chart/range?vs_currency=usd&from=${from}&to=${to}`,
      {
        headers: getCoinGeckoHeaders(),
      }
    );

    if (!response.ok) {
      console.warn(`CoinGecko API error: ${response.status}`);
      return priceMap;
    }

    const data: CoinGeckoMarketChartResponse = await response.json();

    // Convert to date -> price map
    for (const [timestampMs, price] of data.prices) {
      const date = new Date(timestampMs).toISOString().split("T")[0];
      // Keep the most recent price for each day
      priceMap.set(date, price);
    }

    priceCache = { data: priceMap, timestamp: now };
    console.log(`Cached ${priceMap.size} RON price entries`);
  } catch (error) {
    console.warn("Failed to fetch RON price history:", error);
  }

  return priceMap;
}

/**
 * Fetch prices for multiple tokens (AXS, SLP, etc.)
 */
export async function fetchMultiTokenPriceHistory(
  tokenIds: string[],
  fromTimestamp: number,
  toTimestamp: number
): Promise<Map<string, Map<string, number>>> {
  const result = new Map<string, Map<string, number>>();

  for (const tokenId of tokenIds) {
    try {
      await coingeckoRateLimiter.waitForSlot();

      const from = Math.floor(fromTimestamp / 1000);
      const to = Math.floor(toTimestamp / 1000);

      const response = await fetch(
        `${COINGECKO_API_BASE}/coins/${tokenId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`,
        {
          headers: getCoinGeckoHeaders(),
        }
      );

      if (!response.ok) {
        console.warn(`CoinGecko API error for ${tokenId}: ${response.status}`);
        continue;
      }

      const data: CoinGeckoMarketChartResponse = await response.json();
      const priceMap = new Map<string, number>();

      for (const [timestampMs, price] of data.prices) {
        const date = new Date(timestampMs).toISOString().split("T")[0];
        priceMap.set(date, price);
      }

      result.set(tokenId, priceMap);
    } catch (error) {
      console.warn(`Failed to fetch ${tokenId} price history:`, error);
    }
  }

  return result;
}

// CoinGecko token IDs for Ronin ecosystem tokens
export const TOKEN_COINGECKO_IDS: Record<string, string> = {
  RON: "ronin",
  AXS: "axie-infinity",
  SLP: "smooth-love-potion",
  WETH: "weth",
  USDC: "usd-coin",
  PIXEL: "pixels",
};

/**
 * Get CoinGecko ID for a token symbol
 */
export function getCoinGeckoId(symbol: string): string | undefined {
  return TOKEN_COINGECKO_IDS[symbol.toUpperCase()];
}
