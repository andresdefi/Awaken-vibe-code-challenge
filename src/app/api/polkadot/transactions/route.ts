import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllTransfers,
  fetchAllRewards,
  fetchAllSlashes,
  fetchStakingExtrinsics,
  fetchPriceHistory,
} from "@/lib/chains/polkadot/subscan";
import {
  normalizeTransfer,
  normalizeReward,
  normalizeSlash,
  normalizeStakingExtrinsic,
  mergeAndSortTransactions,
} from "@/lib/chains/polkadot/transactions";
import { generateAwakenCSV } from "@/lib/csv";
import { isValidPolkadotAddress } from "@/lib/chains/polkadot/utils";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";
import type { NormalizedTransaction } from "@/lib/types";

export const maxDuration = 120;

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

  if (!isValidPolkadotAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Polkadot address format. Address must start with '1' and be 47-48 characters." },
      { status: 400 }
    );
  }

  try {
    const [transfers, rewards, slashes, stakingExtrinsics] = await Promise.all([
      fetchAllTransfers(address),
      fetchAllRewards(address),
      fetchAllSlashes(address),
      fetchStakingExtrinsics(address),
    ]);

    const allTimestamps = [
      ...transfers.map((t) => t.block_timestamp),
      ...rewards.map((r) => r.block_timestamp),
      ...slashes.map((s) => s.block_timestamp),
      ...stakingExtrinsics.map((e) => e.block_timestamp),
    ];

    let priceMap = new Map<string, number>();
    if (allTimestamps.length > 0) {
      const minTimestamp = Math.min(...allTimestamps);
      const maxTimestamp = Math.max(...allTimestamps);
      const start = new Date(minTimestamp * 1000).toISOString().split("T")[0];
      const end = new Date(maxTimestamp * 1000).toISOString().split("T")[0];
      priceMap = await fetchPriceHistory(start, end);
    }

    const normalizedTransfers: NormalizedTransaction[] = transfers.map((t) =>
      normalizeTransfer(t, address, priceMap)
    );
    const normalizedRewards: NormalizedTransaction[] = rewards.map((r) =>
      normalizeReward(r, priceMap)
    );
    const normalizedSlashes: NormalizedTransaction[] = slashes.map((s) =>
      normalizeSlash(s, priceMap)
    );
    const normalizedStaking: NormalizedTransaction[] = stakingExtrinsics
      .map((e) => normalizeStakingExtrinsic(e, priceMap))
      .filter((tx): tx is NormalizedTransaction => tx !== null);

    const allTransactions = mergeAndSortTransactions(
      normalizedTransfers,
      normalizedRewards,
      normalizedSlashes,
      normalizedStaking
    );

    const filtered = filterByDateRange(allTransactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    if (format === "csv") {
      const csv = generateAwakenCSV(flagged);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="polkadot-${address.slice(0, 8)}-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      address,
      totalTransactions: flagged.length,
      breakdown: {
        transfers: normalizedTransfers.length,
        rewards: normalizedRewards.length,
        slashes: normalizedSlashes.length,
        staking: normalizedStaking.length,
      },
      transactions: flagged,
    });
  } catch (error) {
    console.error("Error fetching Polkadot transactions:", error);
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
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
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
