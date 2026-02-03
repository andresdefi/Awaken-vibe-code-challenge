// dYdX v4 Indexer API Client
// Docs: https://docs.dydx.exchange/api_integration-indexer/indexer_api

import {
  type DydxSubaccount,
  type DydxFill,
  type DydxTransfer,
  type DydxFundingPayment,
  DYDX_INDEXER_BASE,
} from "./types";

// Rate limiter for dYdX API (public indexer, conservative rate limiting)
const RATE_LIMIT_DELAY = 100; // ms between requests
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
  return fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// Validate dYdX address format (Cosmos bech32 with dydx prefix)
export function validateAddress(address: string): boolean {
  if (!address) return false;

  // dYdX v4 addresses start with "dydx1" and are 43 characters
  const dydxAddressRegex = /^dydx1[a-z0-9]{38}$/;
  return dydxAddressRegex.test(address);
}

// Fetch all subaccounts for an address
export async function fetchSubaccounts(address: string): Promise<DydxSubaccount[]> {
  const url = `${DYDX_INDEXER_BASE}/addresses/${address}`;

  const response = await rateLimitedFetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      return []; // Address not found, return empty array
    }
    const errorText = await response.text();
    throw new Error(`dYdX API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.subaccounts || [];
}

// Fetch all fills (trades) for an address and subaccount with pagination
export async function fetchAllFills(
  address: string,
  subaccountNumber: number
): Promise<DydxFill[]> {
  const allFills: DydxFill[] = [];
  let page = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    const url = `${DYDX_INDEXER_BASE}/fills?address=${address}&subaccountNumber=${subaccountNumber}&${params.toString()}`;

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        break; // No more data
      }
      const errorText = await response.text();
      throw new Error(`dYdX API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const fills: DydxFill[] = data.fills || [];

    allFills.push(...fills);

    // Check if there are more pages
    hasMore = fills.length === limit;
    page++;

    // Safety limit to prevent infinite loops
    if (allFills.length >= 10000) {
      console.warn("Reached 10,000 fills limit, stopping pagination");
      break;
    }
  }

  return allFills;
}

// Fetch all transfers (deposits, withdrawals) for an address and subaccount
export async function fetchAllTransfers(
  address: string,
  subaccountNumber: number
): Promise<DydxTransfer[]> {
  const allTransfers: DydxTransfer[] = [];
  let page = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    const url = `${DYDX_INDEXER_BASE}/transfers?address=${address}&subaccountNumber=${subaccountNumber}&${params.toString()}`;

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        break;
      }
      const errorText = await response.text();
      throw new Error(`dYdX API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const transfers: DydxTransfer[] = data.transfers || [];

    allTransfers.push(...transfers);

    hasMore = transfers.length === limit;
    page++;

    if (allTransfers.length >= 10000) {
      console.warn("Reached 10,000 transfers limit, stopping pagination");
      break;
    }
  }

  return allTransfers;
}

// Fetch all funding payments for an address and subaccount
export async function fetchAllFundingPayments(
  address: string,
  subaccountNumber: number
): Promise<DydxFundingPayment[]> {
  const allPayments: DydxFundingPayment[] = [];
  let page = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    const url = `${DYDX_INDEXER_BASE}/historicalFunding?address=${address}&subaccountNumber=${subaccountNumber}&${params.toString()}`;

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        break;
      }
      const errorText = await response.text();
      throw new Error(`dYdX API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const payments: DydxFundingPayment[] = data.historicalFunding || [];

    allPayments.push(...payments);

    hasMore = payments.length === limit;
    page++;

    if (allPayments.length >= 10000) {
      console.warn("Reached 10,000 funding payments limit, stopping pagination");
      break;
    }
  }

  return allPayments;
}

// Aggregate data from all subaccounts
export interface DydxAggregatedData {
  fills: DydxFill[];
  transfers: DydxTransfer[];
  fundingPayments: DydxFundingPayment[];
  subaccounts: DydxSubaccount[];
}

export async function fetchAllDataForAddress(
  address: string
): Promise<DydxAggregatedData> {
  // First get all subaccounts
  const subaccounts = await fetchSubaccounts(address);

  if (subaccounts.length === 0) {
    return {
      fills: [],
      transfers: [],
      fundingPayments: [],
      subaccounts: [],
    };
  }

  // Fetch data from all subaccounts
  const allFills: DydxFill[] = [];
  const allTransfers: DydxTransfer[] = [];
  const allFundingPayments: DydxFundingPayment[] = [];

  for (const subaccount of subaccounts) {
    const [fills, transfers, fundingPayments] = await Promise.all([
      fetchAllFills(address, subaccount.subaccountNumber),
      fetchAllTransfers(address, subaccount.subaccountNumber),
      fetchAllFundingPayments(address, subaccount.subaccountNumber),
    ]);

    allFills.push(...fills);
    allTransfers.push(...transfers);
    allFundingPayments.push(...fundingPayments);
  }

  return {
    fills: allFills,
    transfers: allTransfers,
    fundingPayments: allFundingPayments,
    subaccounts,
  };
}
