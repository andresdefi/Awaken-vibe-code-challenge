// Glue Network Explorer API functions (Blockscout-style)

import type {
  GlueTransaction,
  GlueTokenTransfer,
  GlueApiResponse,
} from "./types";

const API_BASE = "https://backend.explorer.mainnet.prod.gke.glue.net/api";
const MAX_PAGE_SIZE = 100;

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

      if (response.status === 429) {
        // Rate limited
        const waitMs = Math.min(3000 * (i + 1), 10000);
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
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error("Failed to fetch data");
}

/**
 * Get account balance
 */
export async function getAddressBalance(address: string): Promise<string> {
  const url = `${API_BASE}?module=account&action=balance&address=${address}`;
  const response = await fetchWithRetry<GlueApiResponse<string>>(url);

  if (response.status !== "1") {
    throw new Error(response.message || "Failed to fetch balance");
  }

  return response.result;
}

/**
 * Fetch all transactions for an address
 */
export async function fetchAllTransactions(
  address: string,
  onProgress?: (fetched: number) => void
): Promise<GlueTransaction[]> {
  const allTransactions: GlueTransaction[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_BASE}?module=account&action=txlist&address=${address}&page=${page}&offset=${MAX_PAGE_SIZE}&sort=asc`;

    try {
      const response = await fetchWithRetry<GlueApiResponse<GlueTransaction[] | string>>(url);

      if (response.status !== "1" || !Array.isArray(response.result)) {
        // No more transactions or error
        hasMore = false;
      } else {
        allTransactions.push(...response.result);
        onProgress?.(allTransactions.length);

        if (response.result.length < MAX_PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
          // Rate limiting protection
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      if (allTransactions.length === 0) throw error;
      console.warn("Error fetching more transactions:", error);
      hasMore = false;
    }
  }

  return allTransactions;
}

/**
 * Fetch token transfers for an address
 */
export async function fetchTokenTransfers(
  address: string,
  onProgress?: (fetched: number) => void
): Promise<GlueTokenTransfer[]> {
  const allTransfers: GlueTokenTransfer[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_BASE}?module=account&action=tokentx&address=${address}&page=${page}&offset=${MAX_PAGE_SIZE}&sort=asc`;

    try {
      const response = await fetchWithRetry<GlueApiResponse<GlueTokenTransfer[] | string>>(url);

      if (response.status !== "1" || !Array.isArray(response.result)) {
        hasMore = false;
      } else {
        allTransfers.push(...response.result);
        onProgress?.(allTransfers.length);

        if (response.result.length < MAX_PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      if (allTransfers.length === 0) {
        // Token transfers endpoint may not exist or be empty
        console.warn("Token transfers not available:", error);
        return [];
      }
      hasMore = false;
    }
  }

  return allTransfers;
}

/**
 * Get current GLUE price in USD from CoinGecko
 */
export async function getGluePrice(): Promise<number | null> {
  // Check cache
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    return priceCache.price;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=glue&vs_currencies=usd"
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const price = data.glue?.usd;

    if (typeof price === "number") {
      priceCache = { price, timestamp: now };
      return price;
    }

    return null;
  } catch (error) {
    console.warn("Failed to fetch GLUE price:", error);
    return null;
  }
}

/**
 * Verify an address exists by checking its balance or transactions
 */
export async function verifyAddress(address: string): Promise<boolean> {
  try {
    await getAddressBalance(address);
    return true;
  } catch {
    return false;
  }
}
