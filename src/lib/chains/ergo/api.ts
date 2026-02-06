// Ergo Explorer API functions

import type {
  ErgoTransaction,
  ErgoTransactionsResponse,
  ErgoTotalBalance,
} from "./types";

const API_BASE = "https://api.ergoplatform.com/api/v1";
const MAX_PAGE_SIZE = 100; // API supports up to 500, but 100 is safer

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
        throw new Error("Address not found");
      }

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
 * Get address balance
 */
export async function getAddressBalance(address: string): Promise<ErgoTotalBalance> {
  const url = `${API_BASE}/addresses/${address}/balance/total`;
  return fetchWithRetry<ErgoTotalBalance>(url);
}

/**
 * Fetch all transactions for an address
 */
export async function fetchAllTransactions(
  address: string,
  fromHeight?: number,
  toHeight?: number,
  onProgress?: (fetched: number) => void
): Promise<ErgoTransaction[]> {
  const allTransactions: ErgoTransaction[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(MAX_PAGE_SIZE),
      concise: "false",
    });

    if (fromHeight !== undefined) {
      params.set("fromHeight", String(fromHeight));
    }
    if (toHeight !== undefined) {
      params.set("toHeight", String(toHeight));
    }

    const url = `${API_BASE}/addresses/${address}/transactions?${params}`;

    try {
      const response = await fetchWithRetry<ErgoTransactionsResponse>(url);

      if (!response.items || response.items.length === 0) {
        hasMore = false;
      } else {
        allTransactions.push(...response.items);
        offset += response.items.length;
        onProgress?.(allTransactions.length);

        // Check if we've fetched all
        if (response.items.length < MAX_PAGE_SIZE) {
          hasMore = false;
        }

        // Rate limiting protection
        if (response.items.length === MAX_PAGE_SIZE) {
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
 * Get transaction details
 */
export async function getTransaction(txId: string): Promise<ErgoTransaction> {
  const url = `${API_BASE}/transactions/${txId}`;
  return fetchWithRetry<ErgoTransaction>(url);
}

/**
 * Get current ERG price in USD from CoinGecko
 */
export async function getErgPrice(): Promise<number | null> {
  // Check cache
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    return priceCache.price;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ergo&vs_currencies=usd"
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const price = data.ergo?.usd;

    if (typeof price === "number") {
      priceCache = { price, timestamp: now };
      return price;
    }

    return null;
  } catch (error) {
    console.warn("Failed to fetch ERG price:", error);
    return null;
  }
}

/**
 * Verify an address exists by checking its balance
 */
export async function verifyAddress(address: string): Promise<boolean> {
  try {
    await getAddressBalance(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get transaction count for an address
 */
export async function getTransactionCount(address: string): Promise<number> {
  try {
    // Fetch just one transaction to get the total
    const params = new URLSearchParams({
      offset: "0",
      limit: "1",
    });
    const url = `${API_BASE}/addresses/${address}/transactions?${params}`;
    const response = await fetchWithRetry<ErgoTransactionsResponse>(url);
    return response.total || 0;
  } catch {
    return 0;
  }
}
