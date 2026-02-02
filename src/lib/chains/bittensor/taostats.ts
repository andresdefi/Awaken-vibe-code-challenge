import type {
  RawTransfer,
  RawDelegationEvent,
  RawStakeBalanceHistory,
  PaginatedResponse,
  TaoPrice,
} from "./types";

const API_BASE = "https://api.taostats.io/api";
const MAX_LIMIT = 200;
const BURST_LIMIT = 5; // 5 requests per minute
const COOLDOWN_MS = 62000; // 62 seconds cooldown (slightly over 1 min to be safe)

// Global price cache - prices don't change per wallet
let priceCache: { data: Map<string, number>; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiter that allows burst of 5 requests, then waits for cooldown
class RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    // If cooldown period passed, reset the window
    if (elapsed >= COOLDOWN_MS) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // If we've hit the burst limit, wait for cooldown
    if (this.requestCount >= BURST_LIMIT) {
      const waitTime = COOLDOWN_MS - elapsed;
      if (waitTime > 0) {
        console.log(`Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s for cooldown...`);
        await delay(waitTime);
        this.requestCount = 0;
        this.windowStart = Date.now();
      }
    }

    this.requestCount++;
    console.log(`Request ${this.requestCount}/${BURST_LIMIT} in current window`);
  }
}

const rateLimiter = new RateLimiter();

function getHeaders(): HeadersInit {
  const apiKey = process.env.TAOSTATS_API_KEY;
  if (!apiKey) {
    throw new Error("TAOSTATS_API_KEY environment variable is not set");
  }
  return {
    Authorization: apiKey,
    "Content-Type": "application/json",
  };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  url: string,
  retries = 3,
  skipRateLimit = false
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      // Wait for rate limit slot before making request (unless skipped for cached calls)
      if (!skipRateLimit) {
        await rateLimiter.waitForSlot();
      }

      const response = await fetch(url, { headers: getHeaders() });

      // 404 = endpoint doesn't exist for this address, fail fast
      if (response.status === 404) {
        throw new Error(`Endpoint not found (404)`);
      }

      if (response.status === 429) {
        // Rate limited - wait for full cooldown and retry
        console.log(`Got 429, waiting ${COOLDOWN_MS / 1000}s before retry...`);
        await delay(COOLDOWN_MS);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error as Error;
      // Don't retry on 404
      if (lastError.message.includes("404")) {
        throw lastError;
      }
      if (i < retries - 1) {
        await delay(500);
      }
    }
  }

  throw lastError || new Error("Failed to fetch data");
}

export async function fetchAllTransfers(
  address: string,
  timestampStart?: number,
  timestampEnd?: number,
  onProgress?: (fetched: number, total: number) => void
): Promise<RawTransfer[]> {
  const allTransfers: RawTransfer[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      address,
      network: "finney",
      page: String(page),
      limit: String(MAX_LIMIT),
      order: "timestamp_asc",
    });

    if (timestampStart) params.set("timestamp_start", String(timestampStart));
    if (timestampEnd) params.set("timestamp_end", String(timestampEnd));

    const url = `${API_BASE}/transfer/v1?${params}`;
    const response = await fetchWithRetry<PaginatedResponse<RawTransfer>>(url);

    allTransfers.push(...response.data);
    totalPages = response.pagination.total_pages;

    onProgress?.(allTransfers.length, response.pagination.total_items);
    page++;
  }

  return allTransfers;
}

export async function fetchAllDelegationEvents(
  address: string,
  timestampStart?: number,
  timestampEnd?: number,
  onProgress?: (fetched: number, total: number) => void
): Promise<RawDelegationEvent[]> {
  const allEvents: RawDelegationEvent[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      coldkey: address,
      network: "finney",
      page: String(page),
      limit: String(MAX_LIMIT),
      order: "timestamp_asc",
    });

    if (timestampStart) params.set("timestamp_start", String(timestampStart));
    if (timestampEnd) params.set("timestamp_end", String(timestampEnd));

    const url = `${API_BASE}/dtao/delegation/v1?${params}`;

    try {
      const response = await fetchWithRetry<PaginatedResponse<RawDelegationEvent>>(url);
      allEvents.push(...response.data);
      totalPages = response.pagination.total_pages;
      onProgress?.(allEvents.length, response.pagination.total_items);
    } catch (error) {
      // Delegation endpoint might not exist for all addresses
      console.warn("Failed to fetch delegation events:", error);
      onProgress?.(0, 0);
      break;
    }

    page++;
  }

  return allEvents;
}

export async function fetchStakeBalanceHistory(
  address: string,
  timestampStart?: number,
  timestampEnd?: number,
  onProgress?: (fetched: number, total: number) => void
): Promise<RawStakeBalanceHistory[]> {
  const allHistory: RawStakeBalanceHistory[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      address,
      network: "finney",
      page: String(page),
      limit: String(MAX_LIMIT),
      order: "timestamp_asc",
    });

    if (timestampStart) params.set("timestamp_start", String(timestampStart));
    if (timestampEnd) params.set("timestamp_end", String(timestampEnd));

    const url = `${API_BASE}/dtao/stake_balance/history/v1?${params}`;

    try {
      const response = await fetchWithRetry<PaginatedResponse<RawStakeBalanceHistory>>(url);
      allHistory.push(...response.data);
      totalPages = response.pagination.total_pages;
      onProgress?.(allHistory.length, response.pagination.total_items);
    } catch (error) {
      console.warn("Failed to fetch stake balance history:", error);
      onProgress?.(0, 0);
      break;
    }

    page++;
  }

  return allHistory;
}

export async function fetchTaoPriceHistory(
  timestampStart?: number,
  timestampEnd?: number
): Promise<Map<string, number>> {
  // Check cache first - price data is the same for all wallets
  const now = Date.now();
  if (priceCache && (now - priceCache.timestamp) < PRICE_CACHE_TTL) {
    console.log("Using cached price data");
    return priceCache.data;
  }

  const priceMap = new Map<string, number>();

  const params = new URLSearchParams({
    network: "finney",
    limit: String(MAX_LIMIT),
  });

  // Fetch all price history (ignore date filters for caching)
  try {
    const url = `${API_BASE}/price/history/v1?${params}`;
    const response = await fetchWithRetry<PaginatedResponse<TaoPrice>>(url);

    for (const price of response.data) {
      // Store price by date (YYYY-MM-DD)
      const date = price.timestamp.split("T")[0];
      priceMap.set(date, price.price);
    }

    // Cache the result
    priceCache = { data: priceMap, timestamp: now };
    console.log(`Cached ${priceMap.size} price entries`);
  } catch (error) {
    console.warn("Failed to fetch price history:", error);
  }

  return priceMap;
}

export async function fetchCurrentTaoPrice(): Promise<number | null> {
  try {
    const url = `${API_BASE}/price/v1?network=finney`;
    const response = await fetchWithRetry<{ price: number }>(url);
    return response.price;
  } catch (error) {
    console.warn("Failed to fetch current TAO price:", error);
    return null;
  }
}
