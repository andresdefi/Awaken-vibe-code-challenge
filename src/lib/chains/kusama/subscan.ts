import type {
  SubscanListResponse,
  SubscanResponse,
  RawTransfer,
  RawRewardSlash,
  RawExtrinsic,
  SubscanPriceHistory,
  SubscanPrice,
  RawCrowdloanContribution,
  RawAuctionBid,
  RawCrowdloanFund,
} from "./types";

const API_BASE = "https://kusama.api.subscan.io";
const MAX_ROWS = 100;

// Rate limiter for Subscan free tier: 5 requests/second
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 5;
  private readonly windowMs = 1000;

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Remove requests outside the window
    this.requests = this.requests.filter((t) => now - t < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 50; // +50ms buffer
      if (waitTime > 0) {
        await delay(waitTime);
      }
      this.requests = this.requests.filter((t) => Date.now() - t < this.windowMs);
    }

    this.requests.push(Date.now());
  }
}

const rateLimiter = new RateLimiter();

function getHeaders(): HeadersInit {
  const apiKey = process.env.SUBSCAN_API_KEY;
  if (!apiKey) {
    throw new Error("SUBSCAN_API_KEY environment variable is not set");
  }
  return {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  endpoint: string,
  body: Record<string, unknown>,
  retries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      await rateLimiter.waitForSlot();

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
        console.log(`Rate limited, waiting ${waitTime}ms...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Subscan returns code 0 for success
      if (data.code !== 0) {
        throw new Error(`Subscan API error: ${data.message}`);
      }

      return data;
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        await delay(500 * (i + 1)); // Exponential backoff
      }
    }
  }

  throw lastError || new Error("Failed to fetch data");
}

export async function fetchTransfers(
  address: string,
  page = 0,
  row = MAX_ROWS,
  direction?: "sent" | "received"
): Promise<{ transfers: RawTransfer[]; total: number }> {
  const body: Record<string, unknown> = {
    address,
    page,
    row,
  };
  if (direction) {
    body.direction = direction;
  }

  const response = await fetchWithRetry<SubscanListResponse<RawTransfer>>(
    "/api/v2/scan/transfers",
    body
  );

  return {
    transfers: response.data?.list || [],
    total: response.data?.count || 0,
  };
}

export async function fetchAllTransfers(
  address: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<RawTransfer[]> {
  const allTransfers: RawTransfer[] = [];
  let page = 0;
  let total = 0;

  do {
    const { transfers, total: totalCount } = await fetchTransfers(address, page, MAX_ROWS);
    total = totalCount;
    allTransfers.push(...transfers);
    onProgress?.(allTransfers.length, total);
    page++;
  } while (allTransfers.length < total);

  return allTransfers;
}

export async function fetchRewardSlash(
  address: string,
  page = 0,
  row = MAX_ROWS,
  category?: "Reward" | "Slash"
): Promise<{ items: RawRewardSlash[]; total: number }> {
  const body: Record<string, unknown> = {
    address,
    page,
    row,
  };
  if (category) {
    body.category = category;
  }

  const response = await fetchWithRetry<SubscanListResponse<RawRewardSlash>>(
    "/api/scan/account/reward_slash",
    body
  );

  return {
    items: response.data?.list || [],
    total: response.data?.count || 0,
  };
}

export async function fetchAllRewards(
  address: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<RawRewardSlash[]> {
  const allRewards: RawRewardSlash[] = [];
  let page = 0;
  let total = 0;

  do {
    const { items, total: totalCount } = await fetchRewardSlash(address, page, MAX_ROWS, "Reward");
    total = totalCount;
    allRewards.push(...items);
    onProgress?.(allRewards.length, total);
    page++;
  } while (allRewards.length < total);

  return allRewards;
}

export async function fetchAllSlashes(
  address: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<RawRewardSlash[]> {
  const allSlashes: RawRewardSlash[] = [];
  let page = 0;
  let total = 0;

  do {
    const { items, total: totalCount } = await fetchRewardSlash(address, page, MAX_ROWS, "Slash");
    total = totalCount;
    allSlashes.push(...items);
    onProgress?.(allSlashes.length, total);
    page++;
  } while (allSlashes.length < total);

  return allSlashes;
}

export async function fetchExtrinsics(
  address: string,
  page = 0,
  row = MAX_ROWS,
  module?: string
): Promise<{ extrinsics: RawExtrinsic[]; total: number }> {
  const body: Record<string, unknown> = {
    address,
    page,
    row,
  };
  if (module) {
    body.module = module;
  }

  const response = await fetchWithRetry<SubscanListResponse<RawExtrinsic>>(
    "/api/v2/scan/extrinsics",
    body
  );

  return {
    extrinsics: response.data?.list || [],
    total: response.data?.count || 0,
  };
}

export async function fetchStakingExtrinsics(
  address: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<RawExtrinsic[]> {
  const allExtrinsics: RawExtrinsic[] = [];
  let page = 0;
  let total = 0;

  do {
    const { extrinsics, total: totalCount } = await fetchExtrinsics(address, page, MAX_ROWS, "staking");
    total = totalCount;
    allExtrinsics.push(...extrinsics);
    onProgress?.(allExtrinsics.length, total);
    page++;
  } while (allExtrinsics.length < total);

  return allExtrinsics;
}

// ============================================
// Kusama-specific: Crowdloan Contributions
// ============================================

export async function fetchCrowdloanContributions(
  address: string,
  page = 0,
  row = MAX_ROWS
): Promise<{ contributions: RawCrowdloanContribution[]; total: number }> {
  const body: Record<string, unknown> = {
    who: address,
    page,
    row,
  };

  try {
    const response = await fetchWithRetry<SubscanListResponse<RawCrowdloanContribution>>(
      "/api/scan/parachain/contributes",
      body
    );

    return {
      contributions: response.data?.list || [],
      total: response.data?.count || 0,
    };
  } catch (error) {
    // Crowdloan API might not be available for all addresses
    console.warn("Failed to fetch crowdloan contributions:", error);
    return { contributions: [], total: 0 };
  }
}

export async function fetchAllCrowdloanContributions(
  address: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<RawCrowdloanContribution[]> {
  const allContributions: RawCrowdloanContribution[] = [];
  let page = 0;
  let total = 0;

  do {
    const { contributions, total: totalCount } = await fetchCrowdloanContributions(address, page, MAX_ROWS);
    total = totalCount;
    allContributions.push(...contributions);
    onProgress?.(allContributions.length, total);
    page++;

    // If we got 0 contributions on first page, break
    if (contributions.length === 0 && page === 1) break;
  } while (allContributions.length < total && total > 0);

  return allContributions;
}

// Fetch crowdloan fund info to get parachain names
export async function fetchCrowdloanFunds(): Promise<Map<number, RawCrowdloanFund>> {
  const fundMap = new Map<number, RawCrowdloanFund>();

  try {
    const response = await fetchWithRetry<SubscanListResponse<RawCrowdloanFund>>(
      "/api/scan/parachain/funds",
      { row: 100, page: 0 }
    );

    for (const fund of response.data?.list || []) {
      fundMap.set(fund.fund_id, fund);
    }
  } catch (error) {
    console.warn("Failed to fetch crowdloan funds:", error);
  }

  return fundMap;
}

// ============================================
// Kusama-specific: Auction Bids
// ============================================

export async function fetchAuctionBids(
  address: string,
  page = 0,
  row = MAX_ROWS
): Promise<{ bids: RawAuctionBid[]; total: number }> {
  const body: Record<string, unknown> = {
    bidder: address,
    page,
    row,
  };

  try {
    const response = await fetchWithRetry<SubscanListResponse<RawAuctionBid>>(
      "/api/scan/parachain/bids",
      body
    );

    return {
      bids: response.data?.list || [],
      total: response.data?.count || 0,
    };
  } catch (error) {
    console.warn("Failed to fetch auction bids:", error);
    return { bids: [], total: 0 };
  }
}

export async function fetchAllAuctionBids(
  address: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<RawAuctionBid[]> {
  const allBids: RawAuctionBid[] = [];
  let page = 0;
  let total = 0;

  do {
    const { bids, total: totalCount } = await fetchAuctionBids(address, page, MAX_ROWS);
    total = totalCount;
    allBids.push(...bids);
    onProgress?.(allBids.length, total);
    page++;

    if (bids.length === 0 && page === 1) break;
  } while (allBids.length < total && total > 0);

  return allBids;
}

// ============================================
// Price History
// ============================================

// Price cache
let priceCache: { data: Map<string, number>; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchPriceHistory(
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  // Check cache
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    console.log("Using cached KSM price data");
    return priceCache.data;
  }

  const priceMap = new Map<string, number>();

  try {
    const response = await fetchWithRetry<SubscanResponse<{ list: SubscanPriceHistory[] }>>(
      "/api/scan/price/history",
      {
        start: startDate,
        end: endDate,
        format: "day",
      }
    );

    for (const item of response.data?.list || []) {
      // Convert timestamp to date string
      const date = new Date(item.feed_at * 1000).toISOString().split("T")[0];
      priceMap.set(date, parseFloat(item.price));
    }

    priceCache = { data: priceMap, timestamp: now };
    console.log(`Cached ${priceMap.size} price entries for KSM`);
  } catch (error) {
    console.warn("Failed to fetch KSM price history:", error);
  }

  return priceMap;
}

export async function fetchPriceAtTime(timestamp: number): Promise<number | null> {
  try {
    const response = await fetchWithRetry<SubscanResponse<SubscanPrice>>(
      "/api/scan/open/price",
      {
        time: timestamp,
      }
    );

    return response.data?.price ? parseFloat(response.data.price) : null;
  } catch (error) {
    console.warn("Failed to fetch price at time:", error);
    return null;
  }
}
