// Kaspa API functions

import type { KaspaTransaction, KaspaPrice } from "./types";

const API_BASE = "https://api.kaspa.org";
const MAX_LIMIT = 500; // Max allowed by API

// Cache for price to avoid repeated calls
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
        throw new Error("Address not found");
      }

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = response.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
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
 * Fetch all transactions for a Kaspa address
 * Uses pagination with limit/offset
 */
export async function fetchAllTransactions(
  address: string,
  onProgress?: (fetched: number) => void
): Promise<KaspaTransaction[]> {
  const allTransactions: KaspaTransaction[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_BASE}/addresses/${address}/full-transactions?limit=${MAX_LIMIT}&offset=${offset}&resolve_previous_outpoints=light`;

    try {
      const transactions = await fetchWithRetry<KaspaTransaction[]>(url);

      if (!transactions || transactions.length === 0) {
        hasMore = false;
      } else {
        allTransactions.push(...transactions);
        offset += transactions.length;
        onProgress?.(allTransactions.length);

        // If we got fewer than the limit, we've reached the end
        if (transactions.length < MAX_LIMIT) {
          hasMore = false;
        }
      }
    } catch (error) {
      // If it's the first page and we get an error, the address likely doesn't exist
      if (offset === 0) {
        throw error;
      }
      // Otherwise, we've fetched some transactions, return what we have
      console.warn("Error fetching more transactions:", error);
      hasMore = false;
    }
  }

  return allTransactions;
}

/**
 * Fetch current KAS price in USD
 */
export async function fetchKaspaPrice(): Promise<number | null> {
  // Check cache first
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    return priceCache.price;
  }

  try {
    const url = `${API_BASE}/info/price`;
    const data = await fetchWithRetry<KaspaPrice>(url);

    // Cache the price
    priceCache = { price: data.price, timestamp: now };

    return data.price;
  } catch (error) {
    console.warn("Failed to fetch KAS price:", error);
    return null;
  }
}

/**
 * Get transaction count for an address
 */
export async function getTransactionCount(address: string): Promise<number> {
  try {
    const url = `${API_BASE}/addresses/${address}/transactions-count`;
    const data = await fetchWithRetry<{ total: number }>(url);
    return data.total;
  } catch (error) {
    console.warn("Failed to get transaction count:", error);
    return 0;
  }
}
