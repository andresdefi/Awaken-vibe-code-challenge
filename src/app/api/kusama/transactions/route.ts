import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllTransfers,
  fetchAllRewards,
  fetchAllSlashes,
  fetchStakingExtrinsics,
  fetchPriceHistory,
  fetchAllCrowdloanContributions,
  fetchAllAuctionBids,
  fetchCrowdloanFunds,
} from "@/lib/chains/kusama/subscan";
import {
  normalizeTransfer,
  normalizeReward,
  normalizeSlash,
  normalizeStakingExtrinsic,
  normalizeCrowdloanContribution,
  normalizeAuctionBid,
  mergeAndSortTransactions,
} from "@/lib/chains/kusama/transactions";
import { generateAwakenCSV } from "@/lib/csv";
import { isValidKusamaAddress } from "@/lib/chains/kusama/utils";
import type { NormalizedTransaction } from "@/lib/types";

export const maxDuration = 120; // 2 minutes for comprehensive data fetch

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");
  const format = searchParams.get("format") || "json";
  const includeCrowdloans = searchParams.get("crowdloans") !== "false"; // Default: include
  const includeAuctions = searchParams.get("auctions") !== "false"; // Default: include

  if (!address) {
    return NextResponse.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  if (!isValidKusamaAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Kusama address format. Address must start with C, D, E, F, G, H, or J and be 47-48 characters." },
      { status: 400 }
    );
  }

  try {
    // Fetch core data in parallel
    const [transfers, rewards, slashes, stakingExtrinsics] = await Promise.all([
      fetchAllTransfers(address),
      fetchAllRewards(address),
      fetchAllSlashes(address),
      fetchStakingExtrinsics(address),
    ]);

    // Fetch Kusama-specific data (crowdloans and auctions)
    let crowdloanContributions: Awaited<ReturnType<typeof fetchAllCrowdloanContributions>> = [];
    let auctionBids: Awaited<ReturnType<typeof fetchAllAuctionBids>> = [];
    let crowdloanFunds = new Map<number, { para_id: number; name?: string }>();

    if (includeCrowdloans || includeAuctions) {
      // Fetch crowdloan funds for parachain names
      const fundsData = await fetchCrowdloanFunds();
      fundsData.forEach((fund, id) => {
        crowdloanFunds.set(fund.para_id, { para_id: fund.para_id });
      });

      // Fetch crowdloan and auction data in parallel
      const [crowdloans, bids] = await Promise.all([
        includeCrowdloans ? fetchAllCrowdloanContributions(address) : Promise.resolve([]),
        includeAuctions ? fetchAllAuctionBids(address) : Promise.resolve([]),
      ]);

      crowdloanContributions = crowdloans;
      auctionBids = bids;
    }

    // Get date range for price history
    const allTimestamps = [
      ...transfers.map((t) => t.block_timestamp),
      ...rewards.map((r) => r.block_timestamp),
      ...slashes.map((s) => s.block_timestamp),
      ...stakingExtrinsics.map((e) => e.block_timestamp),
      ...crowdloanContributions.map((c) => c.block_timestamp),
      ...auctionBids.map((b) => b.block_timestamp),
    ];

    let priceMap = new Map<string, number>();
    if (allTimestamps.length > 0) {
      const minTimestamp = Math.min(...allTimestamps);
      const maxTimestamp = Math.max(...allTimestamps);
      const startDate = new Date(minTimestamp * 1000).toISOString().split("T")[0];
      const endDate = new Date(maxTimestamp * 1000).toISOString().split("T")[0];
      priceMap = await fetchPriceHistory(startDate, endDate);
    }

    // Build parachain name map (para_id -> name)
    const parachainNames = new Map<number, string>();
    crowdloanFunds.forEach((fund, id) => {
      parachainNames.set(fund.para_id, `Parachain #${fund.para_id}`);
    });

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

    // Normalize crowdloan contributions
    const normalizedCrowdloans: NormalizedTransaction[] = crowdloanContributions.map((c) =>
      normalizeCrowdloanContribution(c, priceMap, parachainNames)
    );

    // Normalize auction bids
    const normalizedAuctions: NormalizedTransaction[] = auctionBids.map((b) =>
      normalizeAuctionBid(b, priceMap, parachainNames)
    );

    // Merge and sort all transactions
    const allTransactions = mergeAndSortTransactions(
      normalizedTransfers,
      normalizedRewards,
      normalizedSlashes,
      normalizedStaking,
      normalizedCrowdloans,
      normalizedAuctions
    );

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenCSV(allTransactions);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="kusama-${address.slice(0, 8)}-awaken.csv"`,
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
        crowdloans: normalizedCrowdloans.length,
        auctions: normalizedAuctions.length,
      },
      transactions: allTransactions,
    });
  } catch (error) {
    console.error("Error fetching Kusama transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
