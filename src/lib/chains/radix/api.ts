// Radix Gateway API functions

import type {
  RadixStreamTransactionsResponse,
  RadixStateEntityDetailsResponse,
  RadixTransaction,
} from "./types";

const GATEWAY_BASE = "https://mainnet.radixdlt.com";
const MAX_PAGE_SIZE = 100; // API supports up to 100

// Price cache
let priceCache: { price: number; timestamp: number } | null = null;
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        // Rate limited
        const waitMs = Math.min(5000 * (i + 1), 15000);
        console.log(`Rate limited, waiting ${waitMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
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
 * Get entity details (account state, balances)
 */
export async function getEntityDetails(
  address: string
): Promise<RadixStateEntityDetailsResponse> {
  const url = `${GATEWAY_BASE}/state/entity/details`;
  const body = {
    addresses: [address],
    aggregation_level: "Global",
    opt_ins: {
      ancestor_identities: false,
      component_royalty_config: false,
      package_royalty_config: false,
      non_fungible_include_nfids: false,
      explicit_metadata: ["symbol", "name", "description"],
    },
  };

  return fetchWithRetry<RadixStateEntityDetailsResponse>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Fetch all transactions for an account
 * Uses the stream/transactions endpoint with balance_changes opt-in
 */
export async function fetchAllTransactions(
  address: string,
  fromTimestamp?: Date,
  toTimestamp?: Date,
  onProgress?: (fetched: number) => void
): Promise<RadixTransaction[]> {
  const allTransactions: RadixTransaction[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const body: Record<string, unknown> = {
      limit_per_page: MAX_PAGE_SIZE,
      order: "Asc",
      opt_ins: {
        receipt: true,
        manifest_instructions: false,
        balance_changes: true,
        raw_hex: false,
        affected_global_entities: true,
        manifest_classes: true,
      },
      // Filter to transactions affecting this account
      affected_global_entities_filter: [address],
      // Only successful transactions
      transaction_status_filter: "Success",
      // Only user transactions (not epoch changes)
      kind_filter: "User",
    };

    if (cursor) {
      body.cursor = cursor;
    }

    // Add time filters if provided
    if (fromTimestamp) {
      body.from_ledger_state = {
        timestamp: fromTimestamp.toISOString(),
      };
    }
    if (toTimestamp) {
      body.at_ledger_state = {
        timestamp: toTimestamp.toISOString(),
      };
    }

    const url = `${GATEWAY_BASE}/stream/transactions`;

    try {
      const response = await fetchWithRetry<RadixStreamTransactionsResponse>(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.items || response.items.length === 0) {
        hasMore = false;
      } else {
        allTransactions.push(...response.items);
        onProgress?.(allTransactions.length);

        if (response.next_cursor) {
          cursor = response.next_cursor;
        } else {
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
 * Get current XRD price in USD from CoinGecko
 */
export async function getXrdPrice(): Promise<number | null> {
  // Check cache
  const now = Date.now();
  if (priceCache && now - priceCache.timestamp < PRICE_CACHE_TTL) {
    return priceCache.price;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=radix&vs_currencies=usd"
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const price = data.radix?.usd;

    if (typeof price === "number") {
      priceCache = { price, timestamp: now };
      return price;
    }

    return null;
  } catch (error) {
    console.warn("Failed to fetch XRD price:", error);
    return null;
  }
}

/**
 * Get transaction count for an account
 * Note: This makes a request with limit 1 just to get the total_count
 */
export async function getTransactionCount(address: string): Promise<number> {
  try {
    const body = {
      limit_per_page: 1,
      affected_global_entities_filter: [address],
      transaction_status_filter: "Success",
      kind_filter: "User",
    };

    const url = `${GATEWAY_BASE}/stream/transactions`;
    const response = await fetchWithRetry<RadixStreamTransactionsResponse>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return response.total_count || 0;
  } catch (error) {
    console.warn("Failed to get transaction count:", error);
    return 0;
  }
}

/**
 * Verify an account exists on the network
 */
export async function verifyAccount(address: string): Promise<boolean> {
  try {
    const details = await getEntityDetails(address);
    return details.items && details.items.length > 0;
  } catch {
    return false;
  }
}
