// MultiversX API functions

import type {
  MultiversXTransfer,
  MultiversXStake,
  MultiversXDelegation,
  MultiversXEconomics,
  MultiversXAccount,
} from "./types";

const API_BASE = "https://api.multiversx.com";
const MAX_PAGE_SIZE = 100; // API max is 10000, but 100 is safer for pagination

// Price cache
let priceCache: { price: number; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithRetry<T>(
  url: string,
  retries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);

      if (response.status === 404) {
        throw new Error("Account not found");
      }

      if (response.status === 429) {
        // Rate limited
        const waitMs = Math.min(5000 * (i + 1), 15000);
        console.log(`Rate limited, waiting ${waitMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error as Error;
      if (lastError.message.includes("not found")) {
        throw lastError;
      }
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error("Failed to fetch data");
}

/**
 * Get account information
 */
export async function getAccount(address: string): Promise<MultiversXAccount> {
  const url = `${API_BASE}/accounts/${address}`;
  return fetchWithRetry<MultiversXAccount>(url);
}

/**
 * Fetch all transfers for an account (native + token transfers)
 */
export async function fetchAllTransfers(
  address: string,
  startTimestamp?: number,
  endTimestamp?: number,
  onProgress?: (fetched: number) => void
): Promise<MultiversXTransfer[]> {
  const allTransfers: MultiversXTransfer[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      from: String(from),
      size: String(MAX_PAGE_SIZE),
      order: "asc",
    });

    if (startTimestamp) params.set("after", String(startTimestamp));
    if (endTimestamp) params.set("before", String(endTimestamp));

    const url = `${API_BASE}/accounts/${address}/transfers?${params}`;

    try {
      const transfers = await fetchWithRetry<MultiversXTransfer[]>(url);

      if (!transfers || transfers.length === 0) {
        hasMore = false;
      } else {
        allTransfers.push(...transfers);
        from += transfers.length;
        onProgress?.(allTransfers.length);

        if (transfers.length < MAX_PAGE_SIZE) {
          hasMore = false;
        }
      }
    } catch (error) {
      if (from === 0) throw error;
      console.warn("Error fetching more transfers:", error);
      hasMore = false;
    }
  }

  return allTransfers;
}

/**
 * Get staking information for an account
 */
export async function getStake(address: string): Promise<MultiversXStake | null> {
  try {
    const url = `${API_BASE}/accounts/${address}/stake`;
    return await fetchWithRetry<MultiversXStake>(url);
  } catch (error) {
    console.warn("Failed to fetch stake info:", error);
    return null;
  }
}

/**
 * Get delegation information for an account
 */
export async function getDelegation(address: string): Promise<MultiversXDelegation[]> {
  try {
    const url = `${API_BASE}/accounts/${address}/delegation`;
    return await fetchWithRetry<MultiversXDelegation[]>(url);
  } catch (error) {
    console.warn("Failed to fetch delegation info:", error);
    return [];
  }
}

/**
 * Get network economics (includes EGLD price)
 */
export async function getEconomics(): Promise<MultiversXEconomics> {
  const url = `${API_BASE}/economics`;
  return fetchWithRetry<MultiversXEconomics>(url);
}

/**
 * Get current EGLD price in USD
 */
export async function getEgldPrice(): Promise<number | null> {
  // Check cache
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    return priceCache.price;
  }

  try {
    const economics = await getEconomics();
    priceCache = { price: economics.price, timestamp: now };
    return economics.price;
  } catch (error) {
    console.warn("Failed to fetch EGLD price:", error);
    return null;
  }
}

/**
 * Get transaction count for an account
 */
export async function getTransferCount(address: string): Promise<number> {
  try {
    const url = `${API_BASE}/accounts/${address}/transfers/count`;
    const count = await fetchWithRetry<number>(url);
    return count;
  } catch (error) {
    console.warn("Failed to get transfer count:", error);
    return 0;
  }
}
