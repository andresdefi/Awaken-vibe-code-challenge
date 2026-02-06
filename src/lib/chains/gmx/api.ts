// GMX V2 (Arbitrum) Subsquid API Client
// Docs: https://gmx.io/

import {
  type GmxTradeAction,
  type GmxGraphQLResponse,
  type GmxClaimAction,
  type GmxClaimGraphQLResponse,
  GMX_SUBSQUID_URL,
} from "./types";

// Rate limiter for GMX Subsquid API
const RATE_LIMIT_DELAY = 200; // ms between requests
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
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

// Validate Ethereum address format
export function validateAddress(address: string): boolean {
  if (!address) return false;
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
}

// GraphQL query for trade actions
const TRADE_ACTIONS_QUERY = `
  query GetTradeActions($account: String!, $skip: Int!, $limit: Int!) {
    tradeActions(
      where: { account_eq: $account }
      orderBy: transaction_timestamp_DESC
      limit: $limit
      offset: $skip
    ) {
      id
      eventName
      account
      marketAddress
      collateralTokenAddress
      sizeDeltaUsd
      collateralDeltaAmount
      basePnlUsd
      priceImpactUsd
      borrowingFeeAmount
      fundingFeeAmount
      positionFeeAmount
      transaction {
        hash
        timestamp
        blockNumber
      }
    }
  }
`;

// GraphQL query for claim actions (funding fee claims)
const CLAIM_ACTIONS_QUERY = `
  query GetClaimActions($account: String!, $skip: Int!, $limit: Int!) {
    claimActions(
      where: { account_eq: $account, eventName_eq: "ClaimFunding" }
      orderBy: transaction_timestamp_DESC
      limit: $limit
      offset: $skip
    ) {
      id
      eventName
      account
      marketAddresses
      amounts
      transaction {
        hash
        timestamp
        blockNumber
      }
    }
  }
`;

// Fetch all trade actions for an address with pagination
export async function fetchAllTradeActions(
  address: string,
  timestampStart?: number,
  timestampEnd?: number
): Promise<GmxTradeAction[]> {
  const allActions: GmxTradeAction[] = [];
  let skip = 0;
  const limit = 1000;
  const MAX_PAGES = 50;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await rateLimitedFetch(GMX_SUBSQUID_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: TRADE_ACTIONS_QUERY,
        variables: {
          account: address.toLowerCase(),
          skip,
          limit,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GMX Subsquid API error (${response.status}): ${errorText}`);
    }

    const result: GmxGraphQLResponse = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new Error(`GMX GraphQL error: ${result.errors[0].message}`);
    }

    const actions = result.data?.tradeActions || [];

    if (actions.length === 0) break;

    // Filter by timestamp if provided
    const filteredActions = actions.filter((action) => {
      const timestamp = action.transaction.timestamp;
      if (timestampStart && timestamp < timestampStart) return false;
      if (timestampEnd && timestamp > timestampEnd) return false;
      return true;
    });

    allActions.push(...filteredActions);

    if (actions.length < limit) break;

    skip += limit;

    // Safety limit
    if (allActions.length >= 50000) {
      console.warn("Reached 50,000 trade actions limit, stopping pagination");
      break;
    }
  }

  return allActions;
}

// Fetch all claim actions (funding fee claims) for an address
export async function fetchAllClaimActions(
  address: string,
  timestampStart?: number,
  timestampEnd?: number
): Promise<GmxClaimAction[]> {
  const allClaims: GmxClaimAction[] = [];
  let skip = 0;
  const limit = 1000;
  const MAX_PAGES = 20;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await rateLimitedFetch(GMX_SUBSQUID_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: CLAIM_ACTIONS_QUERY,
        variables: {
          account: address.toLowerCase(),
          skip,
          limit,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GMX Subsquid API error (${response.status}): ${errorText}`);
    }

    const result: GmxClaimGraphQLResponse = await response.json();

    if (result.errors && result.errors.length > 0) {
      throw new Error(`GMX GraphQL error: ${result.errors[0].message}`);
    }

    const claims = result.data?.claimActions || [];

    if (claims.length === 0) break;

    // Filter by timestamp if provided
    const filteredClaims = claims.filter((claim) => {
      const timestamp = claim.transaction.timestamp;
      if (timestampStart && timestamp < timestampStart) return false;
      if (timestampEnd && timestamp > timestampEnd) return false;
      return true;
    });

    allClaims.push(...filteredClaims);

    if (claims.length < limit) break;

    skip += limit;
  }

  return allClaims;
}

// Aggregated data structure
export interface GmxAggregatedData {
  tradeActions: GmxTradeAction[];
  claimActions: GmxClaimAction[];
}

// Fetch all data for an address
export async function fetchAllDataForAddress(
  address: string,
  timestampStart?: number,
  timestampEnd?: number
): Promise<GmxAggregatedData> {
  // Fetch trade actions and claim actions in parallel
  const [tradeActions, claimActions] = await Promise.all([
    fetchAllTradeActions(address, timestampStart, timestampEnd),
    fetchAllClaimActions(address, timestampStart, timestampEnd),
  ]);

  return {
    tradeActions,
    claimActions,
  };
}
