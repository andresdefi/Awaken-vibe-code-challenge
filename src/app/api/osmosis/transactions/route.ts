import { NextResponse } from "next/server";
import { isValidOsmosisAddress } from "@/lib/chains/osmosis/utils";
import { fetchAllTransactions, fetchPriceHistory } from "@/lib/chains/osmosis/api";
import { normalizeTransactions } from "@/lib/chains/osmosis/transactions";

// Allow up to 3 minutes for this route (fetching can be slow)
export const maxDuration = 180;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  // Validate address
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
    // Fetch all transactions for the address
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

    // Get date range for price fetching
    const timestamps = transactions.map((tx) => tx.timestamp.getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    // Add buffer days for price data
    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 1);

    const startDate = minDate.toISOString().split("T")[0];
    const endDate = maxDate.toISOString().split("T")[0];

    // Fetch price history
    const priceMap = await fetchPriceHistory(startDate, endDate);

    // Normalize transactions
    const normalizedTransactions = normalizeTransactions(
      transactions,
      address,
      priceMap
    );

    // Calculate breakdown
    const breakdown = {
      transfers: 0,
      staking: 0,
      rewards: 0,
      swaps: 0,
      lp: 0,
    };

    for (const tx of normalizedTransactions) {
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
      transactions: normalizedTransactions.map((tx) => ({
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
