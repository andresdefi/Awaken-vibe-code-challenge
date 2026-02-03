// Hedera Mirror Node API Client

import {
  type HederaTransaction,
  type HederaTransactionsResponse,
  type HederaTokenInfo,
  HEDERA_MIRROR_NODE_BASE,
} from "./types";

// Rate limiter for Hedera API (50 req/sec limit, we use 35 req/sec for safety)
const RATE_LIMIT_DELAY = 29; // ms between requests (~35 req/sec)
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  return response;
}

// Validate Hedera account ID format (0.0.xxxxx)
export function isValidAccountId(accountId: string): boolean {
  // Hedera account IDs are in format: shard.realm.account
  // Mainnet shard is 0, realm is 0
  // Account number can be numeric or an alias
  const pattern = /^0\.0\.(\d+|[a-zA-Z0-9]+)$/;
  return pattern.test(accountId);
}

// Normalize account ID (handle common formats)
export function normalizeAccountId(input: string): string {
  const trimmed = input.trim();

  // If already in correct format
  if (/^0\.0\.\d+$/.test(trimmed)) {
    return trimmed;
  }

  // If just a number, prepend 0.0.
  if (/^\d+$/.test(trimmed)) {
    return `0.0.${trimmed}`;
  }

  return trimmed;
}

// Fetch account info to validate it exists
export async function fetchAccountInfo(accountId: string): Promise<boolean> {
  const url = `${HEDERA_MIRROR_NODE_BASE}/accounts/${accountId}`;

  const response = await rateLimitedFetch(url);

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(`Hedera API error (${response.status}): Failed to fetch account`);
  }

  return true;
}

// Fetch all transactions for an account with pagination
export async function fetchAllTransactions(
  accountId: string,
  onProgress?: (count: number) => void
): Promise<HederaTransaction[]> {
  const allTransactions: HederaTransaction[] = [];
  let nextUrl: string | null = `${HEDERA_MIRROR_NODE_BASE}/transactions?account.id=${accountId}&limit=100&order=desc`;

  const maxTransactions = 10000; // Safety limit

  while (nextUrl && allTransactions.length < maxTransactions) {
    const response = await rateLimitedFetch(nextUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hedera API error (${response.status}): ${errorText}`);
    }

    const data: HederaTransactionsResponse = await response.json();

    // Filter for successful transactions only
    const successfulTxs = data.transactions.filter(tx => tx.result === "SUCCESS");
    allTransactions.push(...successfulTxs);

    if (onProgress) {
      onProgress(allTransactions.length);
    }

    // Get next page URL
    if (data.links?.next) {
      // The next link is relative, need to make it absolute
      nextUrl = data.links.next.startsWith("http")
        ? data.links.next
        : `${HEDERA_MIRROR_NODE_BASE}${data.links.next.replace("/api/v1", "")}`;
    } else {
      nextUrl = null;
    }

    // Stop if we got fewer results than requested (end of data)
    if (data.transactions.length < 100) {
      break;
    }
  }

  if (allTransactions.length >= maxTransactions) {
    console.warn(`Reached ${maxTransactions} transactions limit for account ${accountId}`);
  }

  return allTransactions;
}

// Token info cache
const tokenInfoCache: Map<string, HederaTokenInfo> = new Map();

// Fetch token info for resolving symbols
export async function fetchTokenInfo(tokenId: string): Promise<HederaTokenInfo | null> {
  // Check cache first
  if (tokenInfoCache.has(tokenId)) {
    return tokenInfoCache.get(tokenId)!;
  }

  const url = `${HEDERA_MIRROR_NODE_BASE}/tokens/${tokenId}`;

  try {
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const tokenInfo: HederaTokenInfo = {
      token_id: data.token_id,
      symbol: data.symbol || tokenId,
      name: data.name || "",
      decimals: data.decimals || "0",
      type: data.type || "FUNGIBLE_COMMON",
    };

    // Cache the result
    tokenInfoCache.set(tokenId, tokenInfo);

    return tokenInfo;
  } catch {
    return null;
  }
}

// Batch fetch token info for multiple tokens
export async function fetchTokenInfoBatch(tokenIds: string[]): Promise<Map<string, HederaTokenInfo>> {
  const results = new Map<string, HederaTokenInfo>();
  const uniqueIds = [...new Set(tokenIds)];

  for (const tokenId of uniqueIds) {
    const info = await fetchTokenInfo(tokenId);
    if (info) {
      results.set(tokenId, info);
    }
  }

  return results;
}

// Fetch HBAR price from CoinGecko
export async function fetchHbarPrice(timestamp: Date): Promise<number | null> {
  try {
    const dateStr = timestamp.toISOString().split("T")[0];
    const [year, month, day] = dateStr.split("-");
    const formattedDate = `${day}-${month}-${year}`;

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/hedera-hashgraph/history?date=${formattedDate}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.market_data?.current_price?.usd ?? null;
  } catch {
    return null;
  }
}

// Get all unique dates from transactions for batch price fetching
export function getUniqueDates(transactions: HederaTransaction[]): string[] {
  const dates = new Set<string>();

  for (const tx of transactions) {
    const timestamp = parseConsensusTimestamp(tx.consensus_timestamp);
    const dateStr = timestamp.toISOString().split("T")[0];
    dates.add(dateStr);
  }

  return Array.from(dates);
}

// Parse Hedera consensus timestamp (seconds.nanoseconds)
export function parseConsensusTimestamp(consensusTimestamp: string): Date {
  const [seconds] = consensusTimestamp.split(".");
  return new Date(parseInt(seconds) * 1000);
}
