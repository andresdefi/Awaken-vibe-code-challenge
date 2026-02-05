import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllTransfers,
  fetchAllDelegationEvents,
  fetchStakeBalanceHistory,
  fetchTaoPriceHistory,
} from "@/lib/chains/bittensor/taostats";
import {
  normalizeTransfer,
  normalizeDelegationEvent,
  calculateEmissionRewards,
  mergeAndSortTransactions,
} from "@/lib/chains/bittensor/transactions";
import { generateAwakenCSV } from "@/lib/csv";
import { isValidSS58Address } from "@/lib/chains/bittensor/utils";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";
import type { NormalizedTransaction } from "@/lib/types";

export const maxDuration = 300; // Allow up to 5 minutes for rate-limited API calls

interface TransactionParams {
  address: string;
  format?: string;
  startDate?: string;
  endDate?: string;
}

async function handleTransactions(params: TransactionParams) {
  const { address, format = "json", startDate, endDate } = params;

  if (!address) {
    return NextResponse.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  if (!isValidSS58Address(address)) {
    return NextResponse.json(
      { error: "Invalid Bittensor address format. Address must start with '5' and be 46-48 characters." },
      { status: 400 }
    );
  }

  const timestampStart = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined;
  const timestampEnd = endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined;

  try {
    // Fetch data sequentially - rate limiter handles the 5 req/min limit with burst support
    const transfers = await fetchAllTransfers(address, timestampStart, timestampEnd);
    const delegationEvents = await fetchAllDelegationEvents(address, timestampStart, timestampEnd);
    const stakeHistory = await fetchStakeBalanceHistory(address, timestampStart, timestampEnd);
    const priceMap = await fetchTaoPriceHistory(timestampStart, timestampEnd);

    // Normalize transfers
    const normalizedTransfers: NormalizedTransaction[] = transfers.map((t) =>
      normalizeTransfer(t, address, priceMap)
    );

    // Normalize delegation events
    const normalizedDelegations: NormalizedTransaction[] = delegationEvents.map((e) =>
      normalizeDelegationEvent(e, priceMap)
    );

    // Calculate emission rewards from stake history
    const emissionRewards = calculateEmissionRewards(
      stakeHistory,
      delegationEvents,
      priceMap
    );

    // Merge and sort all transactions
    const allTransactions = mergeAndSortTransactions(
      normalizedTransfers,
      normalizedDelegations,
      emissionRewards
    );

    // Apply date filter and ambiguous flagging
    const filtered = filterByDateRange(allTransactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenCSV(flagged);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="bittensor-${address.slice(0, 8)}-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      address,
      totalTransactions: flagged.length,
      breakdown: {
        transfers: normalizedTransfers.length,
        delegations: normalizedDelegations.length,
        emissionRewards: emissionRewards.length,
      },
      transactions: flagged,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  return handleTransactions({
    address: searchParams.get("address") || "",
    format: searchParams.get("format") || "json",
    startDate: searchParams.get("start") || undefined,
    endDate: searchParams.get("end") || undefined,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleTransactions({
    address: body.address || "",
    format: body.format || "json",
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
  });
}
