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
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";
import type { NormalizedTransaction } from "@/lib/types";

export const maxDuration = 120;

interface TransactionParams {
  address: string;
  format?: string;
  includeCrowdloans?: boolean;
  includeAuctions?: boolean;
  startDate?: string;
  endDate?: string;
}

async function handleTransactions(params: TransactionParams) {
  const {
    address,
    format = "json",
    includeCrowdloans = true,
    includeAuctions = true,
    startDate,
    endDate,
  } = params;

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
    const [transfers, rewards, slashes, stakingExtrinsics] = await Promise.all([
      fetchAllTransfers(address),
      fetchAllRewards(address),
      fetchAllSlashes(address),
      fetchStakingExtrinsics(address),
    ]);

    let crowdloanContributions: Awaited<ReturnType<typeof fetchAllCrowdloanContributions>> = [];
    let auctionBids: Awaited<ReturnType<typeof fetchAllAuctionBids>> = [];
    let crowdloanFunds = new Map<number, { para_id: number; name?: string }>();

    if (includeCrowdloans || includeAuctions) {
      const fundsData = await fetchCrowdloanFunds();
      fundsData.forEach((fund, id) => {
        crowdloanFunds.set(fund.para_id, { para_id: fund.para_id });
      });

      const [crowdloans, bids] = await Promise.all([
        includeCrowdloans ? fetchAllCrowdloanContributions(address) : Promise.resolve([]),
        includeAuctions ? fetchAllAuctionBids(address) : Promise.resolve([]),
      ]);

      crowdloanContributions = crowdloans;
      auctionBids = bids;
    }

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
      const start = new Date(minTimestamp * 1000).toISOString().split("T")[0];
      const end = new Date(maxTimestamp * 1000).toISOString().split("T")[0];
      priceMap = await fetchPriceHistory(start, end);
    }

    const parachainNames = new Map<number, string>();
    crowdloanFunds.forEach((fund) => {
      parachainNames.set(fund.para_id, `Parachain #${fund.para_id}`);
    });

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
    const normalizedCrowdloans: NormalizedTransaction[] = crowdloanContributions.map((c) =>
      normalizeCrowdloanContribution(c, priceMap, parachainNames)
    );
    const normalizedAuctions: NormalizedTransaction[] = auctionBids.map((b) =>
      normalizeAuctionBid(b, priceMap, parachainNames)
    );

    const allTransactions = mergeAndSortTransactions(
      normalizedTransfers,
      normalizedRewards,
      normalizedSlashes,
      normalizedStaking,
      normalizedCrowdloans,
      normalizedAuctions
    );

    const filtered = filterByDateRange(allTransactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    if (format === "csv") {
      const csv = generateAwakenCSV(flagged);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="kusama-${address.slice(0, 8)}-awaken.csv"`,
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
        crowdloans: normalizedCrowdloans.length,
        auctions: normalizedAuctions.length,
      },
      transactions: flagged,
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  return handleTransactions({
    address: searchParams.get("address") || "",
    format: searchParams.get("format") || "json",
    includeCrowdloans: searchParams.get("crowdloans") !== "false",
    includeAuctions: searchParams.get("auctions") !== "false",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleTransactions({
    address: body.address || "",
    format: body.format || "json",
    includeCrowdloans: body.crowdloans !== false,
    includeAuctions: body.auctions !== false,
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
  });
}
