import { NextRequest, NextResponse } from "next/server";
import { isValidOsmosisAddress } from "@/lib/chains/osmosis/utils";
import { fetchAllTransactions, fetchPriceHistory } from "@/lib/chains/osmosis/api";
import { normalizeTransactions } from "@/lib/chains/osmosis/transactions";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";

export const maxDuration = 180;

interface TransactionParams {
  address: string;
  startDate?: string;
  endDate?: string;
}

async function handleTransactions(params: TransactionParams) {
  const { address, startDate, endDate } = params;

  if (!address) {
    return NextResponse.json(
      { error: "Address is required" },
      { status: 400 }
    );
  }

  if (!isValidOsmosisAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Osmosis address format. Osmosis addresses start with 'osmo1'." },
      { status: 400 }
    );
  }

  try {
    const transactions = await fetchAllTransactions(address);

    if (transactions.length === 0) {
      return NextResponse.json({
        address,
        transactions: [],
        breakdown: {
          transfers: 0,
          staking: 0,
          rewards: 0,
          swaps: 0,
          lp: 0,
        },
      });
    }

    const timestamps = transactions.map((tx) => tx.timestamp.getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 1);

    const start = minDate.toISOString().split("T")[0];
    const end = maxDate.toISOString().split("T")[0];

    const priceMap = await fetchPriceHistory(start, end);

    const normalizedTransactions = normalizeTransactions(
      transactions,
      address,
      priceMap
    );

    const filtered = filterByDateRange(normalizedTransactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    const breakdown = {
      transfers: 0,
      staking: 0,
      rewards: 0,
      swaps: 0,
      lp: 0,
    };

    for (const tx of flagged) {
      switch (tx.type) {
        case "transfer_sent":
        case "transfer_received":
          if (tx.notes?.includes("Swap")) {
            breakdown.swaps++;
          } else if (tx.notes?.includes("liquidity")) {
            breakdown.lp++;
          } else {
            breakdown.transfers++;
          }
          break;
        case "stake":
        case "unstake":
          if (tx.notes?.includes("Locked") || tx.notes?.includes("Unlocking")) {
            breakdown.lp++;
          } else {
            breakdown.staking++;
          }
          break;
        case "emission_reward":
          breakdown.rewards++;
          break;
        default:
          breakdown.transfers++;
      }
    }

    return NextResponse.json({
      address,
      transactions: flagged.map((tx) => ({
        ...tx,
        timestamp: tx.timestamp.toISOString(),
      })),
      breakdown,
    });
  } catch (error) {
    console.error("Error fetching Osmosis transactions:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch transactions",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handleTransactions({
    address: searchParams.get("address") || "",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return handleTransactions({
    address: body.address || "",
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
  });
}
