// Stellar Horizon API Client

import {
  type StellarOperation,
  type StellarOperationsResponse,
  type StellarAccountResponse,
  type StellarTransactionDetails,
  STELLAR_HORIZON_URL,
  STROOPS_PER_XLM,
} from "./types";

// Rate limiter - Horizon is generally permissive but we add small delays
const RATE_LIMIT_DELAY = 50; // ms between requests
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

// Validate Stellar address format (G-prefixed, 56 characters)
export function isValidStellarAddress(address: string): boolean {
  // Standard Stellar addresses start with G and are 56 characters (Base32)
  const stellarPattern = /^G[A-Z2-7]{55}$/;

  // Muxed addresses start with M
  const muxedPattern = /^M[A-Z2-7]{68}$/;

  return stellarPattern.test(address) || muxedPattern.test(address);
}

// Normalize address input
export function normalizeAddress(input: string): string {
  return input.trim().toUpperCase();
}

// Check if account exists on the network
export async function fetchAccountInfo(
  address: string
): Promise<StellarAccountResponse | null> {
  try {
    const response = await rateLimitedFetch(
      `${STELLAR_HORIZON_URL}/accounts/${address}`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Horizon API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error checking account:", error);
    throw error;
  }
}

// Cache for transaction details (to get fees)
const transactionCache = new Map<string, StellarTransactionDetails>();

// Fetch transaction details to get fee
export async function fetchTransactionDetails(
  hash: string
): Promise<StellarTransactionDetails | null> {
  // Check cache first
  if (transactionCache.has(hash)) {
    return transactionCache.get(hash)!;
  }

  try {
    const response = await rateLimitedFetch(
      `${STELLAR_HORIZON_URL}/transactions/${hash}`
    );

    if (!response.ok) {
      return null;
    }

    const data: StellarTransactionDetails = await response.json();
    transactionCache.set(hash, data);
    return data;
  } catch {
    return null;
  }
}

// Fetch all operations for an account using pagination
export async function fetchAllOperations(
  address: string,
  onProgress?: (count: number) => void
): Promise<StellarOperation[]> {
  const allOperations: StellarOperation[] = [];
  const maxOperations = 10000; // Safety limit
  let nextUrl: string | null =
    `${STELLAR_HORIZON_URL}/accounts/${address}/operations?limit=200&order=desc`;

  while (nextUrl && allOperations.length < maxOperations) {
    const response = await rateLimitedFetch(nextUrl);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Horizon API error (${response.status}): ${errorText}`);
    }

    const data: StellarOperationsResponse = await response.json();

    // Process operations
    for (const op of data._embedded.records) {
      // Only include successful operations
      if (op.transaction_successful) {
        allOperations.push(op);
      }
    }

    if (onProgress) {
      onProgress(allOperations.length);
    }

    // Check for more pages
    if (
      data._embedded.records.length === 200 &&
      data._links.next?.href
    ) {
      nextUrl = data._links.next.href;
    } else {
      nextUrl = null;
    }
  }

  if (allOperations.length >= maxOperations) {
    console.warn(`Reached ${maxOperations} operations limit for ${address}`);
  }

  return allOperations;
}

// Convert stroops to XLM
export function stroopsToXLM(stroops: string | number): number {
  const stroopsNum =
    typeof stroops === "string" ? parseInt(stroops, 10) : stroops;
  return stroopsNum / STROOPS_PER_XLM;
}

// Parse amount string to number
export function parseAmount(amount: string): number {
  return parseFloat(amount);
}

// Get asset display name
export function getAssetName(
  assetType?: string,
  assetCode?: string
): string {
  if (!assetType || assetType === "native") {
    return "XLM";
  }
  return assetCode || "UNKNOWN";
}

// Fetch XLM price from CoinGecko
export async function fetchXLMPrice(timestamp: Date): Promise<number | null> {
  try {
    const dateStr = timestamp.toISOString().split("T")[0];
    const [year, month, day] = dateStr.split("-");
    const formattedDate = `${day}-${month}-${year}`;

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/stellar/history?date=${formattedDate}`,
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

// Get unique dates from operations for batch price fetching
export function getUniqueDates(operations: StellarOperation[]): string[] {
  const dates = new Set<string>();

  for (const op of operations) {
    const timestamp = new Date(op.created_at);
    const dateStr = timestamp.toISOString().split("T")[0];
    dates.add(dateStr);
  }

  return Array.from(dates);
}

// Decode memo value if present
export function decodeMemo(
  memoType: string,
  memo?: string,
  memoBytes?: string
): string {
  if (!memo && !memoBytes) return "";

  if (memoType === "text" && memo) {
    return memo;
  }

  if (memoType === "hash" || memoType === "return") {
    // These are typically hex/base64 encoded
    return memo || memoBytes || "";
  }

  if (memoType === "id" && memo) {
    return `Memo ID: ${memo}`;
  }

  return memo || "";
}
