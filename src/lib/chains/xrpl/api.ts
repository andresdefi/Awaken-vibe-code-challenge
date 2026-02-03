// XRPL API Client

import {
  type XRPLTransaction,
  type XRPLAccountTxResponse,
  type XRPLAccountInfoResponse,
  XRPL_MAINNET_SERVER,
  DROPS_PER_XRP,
} from "./types";

// Rate limiter - XRPL public servers have dynamic rate limiting
// We use a conservative approach to avoid disconnection
const RATE_LIMIT_DELAY = 100; // ms between requests
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, body: object): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return response;
}

// Validate XRP address format (classic address starting with r)
export function isValidXRPAddress(address: string): boolean {
  // Classic addresses start with r and are 25-35 characters
  // X-addresses start with X (mainnet) or T (testnet)
  const classicPattern = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
  const xAddressPattern = /^X[1-9A-HJ-NP-Za-km-z]{46}$/;

  return classicPattern.test(address) || xAddressPattern.test(address);
}

// Normalize address input
export function normalizeAddress(input: string): string {
  return input.trim();
}

// Check if account exists on the ledger
export async function fetchAccountInfo(address: string): Promise<boolean> {
  const body = {
    method: "account_info",
    params: [
      {
        account: address,
        ledger_index: "validated",
      },
    ],
  };

  try {
    const response = await rateLimitedFetch(XRPL_MAINNET_SERVER, body);

    if (!response.ok) {
      throw new Error(`XRPL API error: ${response.status}`);
    }

    const data: XRPLAccountInfoResponse = await response.json();

    if (data.result.error === "actNotFound") {
      return false;
    }

    return data.result.status === "success" && !!data.result.account_data;
  } catch (error) {
    console.error("Error checking account:", error);
    throw error;
  }
}

// Fetch all transactions for an account using account_tx
export async function fetchAllTransactions(
  address: string,
  onProgress?: (count: number) => void
): Promise<XRPLTransaction[]> {
  const allTransactions: XRPLTransaction[] = [];
  const maxTransactions = 10000; // Safety limit
  let marker: { ledger: number; seq: number } | undefined;
  let hasMore = true;

  while (hasMore && allTransactions.length < maxTransactions) {
    const params: Record<string, unknown> = {
      account: address,
      ledger_index_min: -1, // From earliest
      ledger_index_max: -1, // To latest
      limit: 200, // Max per request
      forward: false, // Most recent first
    };

    if (marker) {
      params.marker = marker;
    }

    const body = {
      method: "account_tx",
      params: [params],
    };

    const response = await rateLimitedFetch(XRPL_MAINNET_SERVER, body);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`XRPL API error (${response.status}): ${errorText}`);
    }

    const data: XRPLAccountTxResponse = await response.json();

    if (data.result.status !== "success") {
      throw new Error("XRPL API returned unsuccessful status");
    }

    // Process transactions
    for (const txWrapper of data.result.transactions) {
      // Only include validated successful transactions
      if (
        txWrapper.validated &&
        txWrapper.meta?.TransactionResult === "tesSUCCESS"
      ) {
        const tx = txWrapper.tx;
        // Attach metadata to the transaction
        tx.meta = txWrapper.meta;
        allTransactions.push(tx);
      }
    }

    if (onProgress) {
      onProgress(allTransactions.length);
    }

    // Check for more pages
    if (data.result.marker) {
      marker = data.result.marker;
    } else {
      hasMore = false;
    }

    // Stop if we got fewer results than requested
    if (data.result.transactions.length < 200) {
      hasMore = false;
    }
  }

  if (allTransactions.length >= maxTransactions) {
    console.warn(`Reached ${maxTransactions} transactions limit for ${address}`);
  }

  return allTransactions;
}

// Convert drops to XRP
export function dropsToXRP(drops: string | number): number {
  const dropsNum = typeof drops === "string" ? parseInt(drops, 10) : drops;
  return dropsNum / DROPS_PER_XRP;
}

// Parse XRPL amount (can be drops string or currency object)
export function parseAmount(
  amount: string | { currency: string; issuer?: string; value: string }
): { value: number; currency: string; issuer?: string } {
  if (typeof amount === "string") {
    // XRP amount in drops
    return {
      value: dropsToXRP(amount),
      currency: "XRP",
    };
  }

  // Issued currency
  return {
    value: parseFloat(amount.value),
    currency: amount.currency,
    issuer: amount.issuer,
  };
}

// Convert Ripple epoch to JavaScript Date
// Ripple epoch is January 1, 2000 (946684800 seconds after Unix epoch)
export function rippleTimeToDate(rippleTime: number): Date {
  const RIPPLE_EPOCH = 946684800;
  return new Date((rippleTime + RIPPLE_EPOCH) * 1000);
}

// Fetch XRP price from CoinGecko
export async function fetchXRPPrice(timestamp: Date): Promise<number | null> {
  try {
    const dateStr = timestamp.toISOString().split("T")[0];
    const [year, month, day] = dateStr.split("-");
    const formattedDate = `${day}-${month}-${year}`;

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/ripple/history?date=${formattedDate}`,
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

// Get unique dates from transactions for batch price fetching
export function getUniqueDates(transactions: XRPLTransaction[]): string[] {
  const dates = new Set<string>();

  for (const tx of transactions) {
    const timestamp = rippleTimeToDate(tx.date);
    const dateStr = timestamp.toISOString().split("T")[0];
    dates.add(dateStr);
  }

  return Array.from(dates);
}

// Decode hex memo to string
export function decodeMemo(memoHex?: string): string {
  if (!memoHex) return "";

  try {
    // Convert hex to bytes
    const bytes = new Uint8Array(
      memoHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

// Format currency code (handle hex currency codes)
export function formatCurrencyCode(code: string): string {
  if (code.length === 3) {
    return code;
  }

  // 40-character hex currency code
  if (code.length === 40) {
    try {
      // Remove trailing zeros and convert from hex
      const trimmed = code.replace(/0+$/, "");
      const bytes = new Uint8Array(
        trimmed.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );
      const decoded = new TextDecoder().decode(bytes);
      // Return decoded if printable, otherwise return abbreviated hex
      if (/^[\x20-\x7E]+$/.test(decoded)) {
        return decoded;
      }
    } catch {
      // Fall through
    }
    // Return abbreviated hex code
    return `${code.slice(0, 4)}...${code.slice(-4)}`;
  }

  return code;
}
