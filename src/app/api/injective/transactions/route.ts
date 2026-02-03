import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllTransactions,
  fetchPriceHistory,
} from "@/lib/chains/injective/api";
import {
  normalizeTransaction,
  mergeAndSortTransactions,
} from "@/lib/chains/injective/transactions";
import { generateAwakenCSV } from "@/lib/csv";
import { isValidInjectiveAddress } from "@/lib/chains/injective/utils";
import type { NormalizedTransaction } from "@/lib/types";

export const maxDuration = 120; // 2 minutes for comprehensive data fetch

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

  if (!isValidInjectiveAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Injective address format. Address must start with 'inj1' and be 43 characters." },
      { status: 400 }
    );
  }

  try {
    // Fetch all transactions
    const transactions = await fetchAllTransactions(address);

    if (transactions.length === 0) {
      if (format === "csv") {
        const csv = generateAwakenCSV([]);
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="injective-${address.slice(0, 8)}-awaken.csv"`,
          },
        });
      }

      return NextResponse.json({
        address,
        totalTransactions: 0,
        breakdown: {
          transfers: 0,
          staking: 0,
          rewards: 0,
          trades: 0,
          ibc: 0,
        },
        transactions: [],
      });
    }

    // Get date range for price history
    const timestamps = transactions.map((tx) => tx.timestamp.getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const startDate = new Date(minTimestamp).toISOString().split("T")[0];
    const endDate = new Date(maxTimestamp).toISOString().split("T")[0];

    // Fetch price history
    const priceMap = await fetchPriceHistory(startDate, endDate);

    // Normalize all transactions
    const allNormalized: NormalizedTransaction[] = [];

    for (const tx of transactions) {
      const normalized = normalizeTransaction(tx, address, priceMap);
      allNormalized.push(...normalized);
    }

    // Merge and sort
    const sortedTransactions = mergeAndSortTransactions(allNormalized);

    // Calculate breakdown
    const breakdown = {
      transfers: 0,
      staking: 0,
      rewards: 0,
      trades: 0,
      ibc: 0,
    };

    for (const tx of sortedTransactions) {
      if (tx.type === "transfer_sent" || tx.type === "transfer_received") {
        if (tx.tag === "wallet_transfer") {
          breakdown.ibc++;
        } else {
          breakdown.transfers++;
        }
      } else if (tx.type === "stake" || tx.type === "unstake" || tx.type === "bond" || tx.type === "unbond") {
        breakdown.staking++;
      } else if (tx.type === "emission_reward") {
        breakdown.rewards++;
      } else if (tx.type === "swap") {
        breakdown.trades++;
      }
    }

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenCSV(sortedTransactions);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="injective-${address.slice(0, 8)}-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      address,
      totalTransactions: sortedTransactions.length,
      breakdown,
      transactions: sortedTransactions,
    });
  } catch (error) {
    console.error("Error fetching Injective transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
