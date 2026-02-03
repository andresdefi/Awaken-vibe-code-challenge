// Canton Network API Client
// Uses Canton Nodes public API: https://api.cantonnodes.com

import {
  type CantonUpdate,
  type CantonUpdatesResponse,
  type CantonLatestRoundResponse,
  type CantonWalletBalance,
  CANTON_API_BASE,
} from "./types";

// Rate limiter for Canton Nodes API (free tier is rate limited)
const RATE_LIMIT_DELAY = 200; // ms between requests (conservative for free tier)
let lastRequestTime = 0;

async function rateLimitedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...options.headers,
    },
  });

  return response;
}

// Get latest round number (for balance queries)
export async function fetchLatestRound(): Promise<number> {
  const url = `${CANTON_API_BASE}/v0/round-of-latest-data`;

  const response = await rateLimitedFetch(url);

  if (!response.ok) {
    throw new Error(`Canton API error (${response.status}): Failed to fetch latest round`);
  }

  const data: CantonLatestRoundResponse = await response.json();
  return data.round;
}

// Get wallet balance for a party at a specific round
export async function fetchWalletBalance(
  partyId: string,
  round?: number
): Promise<CantonWalletBalance | null> {
  // If no round specified, get latest
  const targetRound = round ?? (await fetchLatestRound());

  const url = `${CANTON_API_BASE}/v0/wallet-balance?party_id=${encodeURIComponent(partyId)}&asOfEndOfRound=${targetRound}`;

  const response = await rateLimitedFetch(url);

  if (response.status === 404) {
    return null; // Party not found or no balance
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Canton API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Fetch transaction updates with pagination
export async function fetchUpdates(
  pageSize: number = 100,
  afterMigrationId?: number,
  afterRecordTime?: string
): Promise<CantonUpdate[]> {
  const url = `${CANTON_API_BASE}/v2/updates`;

  const body: {
    page_size: number;
    after?: {
      after_migration_id: number;
      after_record_time: string;
    };
  } = {
    page_size: pageSize,
  };

  if (afterMigrationId !== undefined && afterRecordTime) {
    body.after = {
      after_migration_id: afterMigrationId,
      after_record_time: afterRecordTime,
    };
  }

  const response = await rateLimitedFetch(url, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Canton API error (${response.status}): ${errorText}`);
  }

  const data: CantonUpdatesResponse = await response.json();
  return data.transactions || [];
}

// Fetch all updates for a time range, filtering by party
export async function fetchAllUpdatesForParty(
  partyId: string,
  maxUpdates: number = 5000,
  onProgress?: (count: number) => void
): Promise<CantonUpdate[]> {
  const allUpdates: CantonUpdate[] = [];
  const partyIdLower = partyId.toLowerCase();

  let afterMigrationId: number | undefined;
  let afterRecordTime: string | undefined;
  let hasMore = true;

  while (hasMore && allUpdates.length < maxUpdates) {
    const updates = await fetchUpdates(100, afterMigrationId, afterRecordTime);

    if (updates.length === 0) {
      hasMore = false;
      break;
    }

    // Filter updates that involve this party
    for (const update of updates) {
      if (updateInvolvesParty(update, partyIdLower)) {
        allUpdates.push(update);
      }
    }

    // Get pagination cursor from last update
    const lastUpdate = updates[updates.length - 1];
    afterMigrationId = lastUpdate.migration_id;
    afterRecordTime = lastUpdate.record_time;

    // If we got fewer updates than requested, we've reached the end
    if (updates.length < 100) {
      hasMore = false;
    }

    if (onProgress) {
      onProgress(allUpdates.length);
    }

    // Safety check to prevent infinite loops
    if (allUpdates.length >= maxUpdates) {
      console.warn(`Reached ${maxUpdates} updates limit for party ${partyId}`);
      break;
    }
  }

  return allUpdates;
}

// Check if an update involves a specific party
function updateInvolvesParty(update: CantonUpdate, partyIdLower: string): boolean {
  // Check all events in the update
  for (const event of Object.values(update.events_by_id)) {
    // Check create_arguments for party references
    if (event.create_arguments) {
      const argsStr = JSON.stringify(event.create_arguments).toLowerCase();
      if (argsStr.includes(partyIdLower)) {
        return true;
      }
    }

    // Check choice_argument for party references
    if (event.choice_argument) {
      const argsStr = JSON.stringify(event.choice_argument).toLowerCase();
      if (argsStr.includes(partyIdLower)) {
        return true;
      }
    }

    // Check exercise_result for party references
    if (event.exercise_result) {
      const resultStr = JSON.stringify(event.exercise_result).toLowerCase();
      if (resultStr.includes(partyIdLower)) {
        return true;
      }
    }
  }

  return false;
}

// Validate Canton Party ID format
export function isValidPartyId(partyId: string): boolean {
  // Format: hint::hash where hash is typically 1220[64 hex chars]
  // Example: Digital-Asset-2::12209b21d512c6a7e2f5d215266fe6568cb732caaef7ff04e308f990a652340d3529

  if (!partyId || typeof partyId !== "string") {
    return false;
  }

  const parts = partyId.split("::");
  if (parts.length !== 2) {
    return false;
  }

  const [hint, hash] = parts;

  // Hint should be non-empty
  if (!hint || hint.length === 0) {
    return false;
  }

  // Hash should be 64+ hex characters, often starting with 1220
  if (!hash || hash.length < 64) {
    return false;
  }

  // Check if hash is valid hex
  if (!/^[a-fA-F0-9]+$/.test(hash)) {
    return false;
  }

  return true;
}

// Get DSO party ID (for reference)
export async function fetchDsoPartyId(): Promise<string> {
  const url = `${CANTON_API_BASE}/v0/dso-party-id`;

  const response = await rateLimitedFetch(url);

  if (!response.ok) {
    throw new Error(`Canton API error (${response.status}): Failed to fetch DSO party ID`);
  }

  const data: { dso_party_id: string } = await response.json();
  return data.dso_party_id;
}
