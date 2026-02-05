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

  if (!isValidInjectiveAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Injective address format. Address must start with 'inj1' and be 43 characters." },
      { status: 400 }
    );
  }

  try {
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

    const timestamps = transactions.map((tx) => tx.timestamp.getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const start = new Date(minTimestamp).toISOString().split("T")[0];
    const end = new Date(maxTimestamp).toISOString().split("T")[0];

    const priceMap = await fetchPriceHistory(start, end);

    const allNormalized: NormalizedTransaction[] = [];
    for (const tx of transactions) {
      const normalized = normalizeTransaction(tx, address, priceMap);
      allNormalized.push(...normalized);
    }

    const sortedTransactions = mergeAndSortTransactions(allNormalized);

    const filtered = filterByDateRange(sortedTransactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    const breakdown = {
      transfers: 0,
      staking: 0,
      rewards: 0,
      trades: 0,
      ibc: 0,
    };

    for (const tx of flagged) {
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

    if (format === "csv") {
      const csv = generateAwakenCSV(flagged);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="injective-${address.slice(0, 8)}-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      address,
      totalTransactions: flagged.length,
      breakdown,
      transactions: flagged,
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
