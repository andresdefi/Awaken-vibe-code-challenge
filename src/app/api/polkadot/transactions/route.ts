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
import type { NormalizedTransaction } from "@/lib/types";

export const maxDuration = 120; // 2 minutes should be enough with 5 req/s rate limit

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");
  const format = searchParams.get("format") || "json";

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
    // Fetch all data in parallel where possible
    const [transfers, rewards, slashes, stakingExtrinsics] = await Promise.all([
      fetchAllTransfers(address),
      fetchAllRewards(address),
      fetchAllSlashes(address),
      fetchStakingExtrinsics(address),
    ]);

    // Get date range for price history
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
      const startDate = new Date(minTimestamp * 1000).toISOString().split("T")[0];
      const endDate = new Date(maxTimestamp * 1000).toISOString().split("T")[0];
      priceMap = await fetchPriceHistory(startDate, endDate);
    }

    // Normalize transfers
    const normalizedTransfers: NormalizedTransaction[] = transfers.map((t) =>
      normalizeTransfer(t, address, priceMap)
    );

    // Normalize rewards
    const normalizedRewards: NormalizedTransaction[] = rewards.map((r) =>
      normalizeReward(r, priceMap)
    );

    // Normalize slashes
    const normalizedSlashes: NormalizedTransaction[] = slashes.map((s) =>
      normalizeSlash(s, priceMap)
    );

    // Normalize staking extrinsics (bond, unbond, etc.)
    const normalizedStaking: NormalizedTransaction[] = stakingExtrinsics
      .map((e) => normalizeStakingExtrinsic(e, priceMap))
      .filter((tx): tx is NormalizedTransaction => tx !== null);

    // Merge and sort all transactions
    const allTransactions = mergeAndSortTransactions(
      normalizedTransfers,
      normalizedRewards,
      normalizedSlashes,
      normalizedStaking
    );

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenCSV(allTransactions);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="polkadot-${address.slice(0, 8)}-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      address,
      totalTransactions: allTransactions.length,
      breakdown: {
        transfers: normalizedTransfers.length,
        rewards: normalizedRewards.length,
        slashes: normalizedSlashes.length,
        staking: normalizedStaking.length,
      },
      transactions: allTransactions,
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
