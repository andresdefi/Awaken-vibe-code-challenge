// Extended Exchange API Client
// Docs: https://api.docs.extended.exchange/

import {
  type ExtendedTrade,
  type ExtendedFundingPayment,
  type ExtendedAssetOperation,
  type ExtendedPaginatedResponse,
  EXTENDED_API_BASE,
} from "./types";

// Rate limiter for Extended API
// Extended doesn't publish explicit rate limits, using conservative 10 req/sec
const RATE_LIMIT_DELAY = 100; // ms between requests
let lastRequestTime = 0;

async function rateLimitedFetch(
  url: string,
  options: RequestInit
): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
  return fetch(url, options);
}

// Helper to create authenticated headers
function getAuthHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Api-Key": apiKey,
  };
}

// Fetch all trades with pagination
export async function fetchAllTrades(
  apiKey: string,
  options?: {
    market?: string;
    startTime?: number;
    endTime?: number;
  }
): Promise<ExtendedTrade[]> {
  const allTrades: ExtendedTrade[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    if (options?.market) params.set("market", options.market);
    if (options?.startTime) params.set("start_time", options.startTime.toString());
    if (options?.endTime) params.set("end_time", options.endTime.toString());
    if (cursor) params.set("cursor", cursor);
    params.set("limit", "100");

    const url = `${EXTENDED_API_BASE}/v1/trades?${params.toString()}`;

    const response = await rateLimitedFetch(url, {
      method: "GET",
      headers: getAuthHeaders(apiKey),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Extended API error (${response.status}): ${errorText}`);
    }

    const data: ExtendedPaginatedResponse<ExtendedTrade> = await response.json();
    allTrades.push(...data.data);

    cursor = data.cursor;
    hasMore = data.has_more;

    // Safety limit to prevent infinite loops
    if (allTrades.length >= 10000) {
      console.warn("Reached 10,000 trades limit, stopping pagination");
      break;
    }
  }

  return allTrades;
}

// Fetch all funding payments with pagination
export async function fetchAllFundingPayments(
  apiKey: string,
  options?: {
    market?: string;
    startTime?: number;
    endTime?: number;
  }
): Promise<ExtendedFundingPayment[]> {
  const allPayments: ExtendedFundingPayment[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    if (options?.market) params.set("market", options.market);
    if (options?.startTime) params.set("start_time", options.startTime.toString());
    if (options?.endTime) params.set("end_time", options.endTime.toString());
    if (cursor) params.set("cursor", cursor);
    params.set("limit", "100");

    const url = `${EXTENDED_API_BASE}/v1/funding-payments?${params.toString()}`;

    const response = await rateLimitedFetch(url, {
      method: "GET",
      headers: getAuthHeaders(apiKey),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Extended API error (${response.status}): ${errorText}`);
    }

    const data: ExtendedPaginatedResponse<ExtendedFundingPayment> = await response.json();
    allPayments.push(...data.data);

    cursor = data.cursor;
    hasMore = data.has_more;

    // Safety limit
    if (allPayments.length >= 10000) {
      console.warn("Reached 10,000 funding payments limit, stopping pagination");
      break;
    }
  }

  return allPayments;
}

// Fetch all asset operations (deposits, withdrawals, transfers)
export async function fetchAllAssetOperations(
  apiKey: string,
  options?: {
    type?: "deposit" | "withdrawal" | "transfer_in" | "transfer_out";
    startTime?: number;
    endTime?: number;
  }
): Promise<ExtendedAssetOperation[]> {
  const allOperations: ExtendedAssetOperation[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    if (options?.type) params.set("type", options.type);
    if (options?.startTime) params.set("start_time", options.startTime.toString());
    if (options?.endTime) params.set("end_time", options.endTime.toString());
    if (cursor) params.set("cursor", cursor);
    params.set("limit", "50");

    const url = `${EXTENDED_API_BASE}/v1/asset-operations?${params.toString()}`;

    const response = await rateLimitedFetch(url, {
      method: "GET",
      headers: getAuthHeaders(apiKey),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Extended API error (${response.status}): ${errorText}`);
    }

    const data: ExtendedPaginatedResponse<ExtendedAssetOperation> = await response.json();
    allOperations.push(...data.data);

    cursor = data.cursor;
    hasMore = data.has_more;

    // Safety limit
    if (allOperations.length >= 10000) {
      console.warn("Reached 10,000 asset operations limit, stopping pagination");
      break;
    }
  }

  return allOperations;
}

// Validate API key by making a simple account request
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const url = `${EXTENDED_API_BASE}/v1/account`;
    const response = await rateLimitedFetch(url, {
      method: "GET",
      headers: getAuthHeaders(apiKey),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Get account info (for display purposes)
export async function getAccountInfo(
  apiKey: string
): Promise<{ subAccountId: string; email?: string } | null> {
  try {
    const url = `${EXTENDED_API_BASE}/v1/account`;
    const response = await rateLimitedFetch(url, {
      method: "GET",
      headers: getAuthHeaders(apiKey),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      subAccountId: data.sub_account_id || data.id || "unknown",
      email: data.email,
    };
  } catch {
    return null;
  }
}
