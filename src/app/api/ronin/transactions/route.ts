import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllWalletHistory,
  fetchPriceHistory,
} from "@/lib/chains/ronin/moralis";
import {
  normalizeWalletHistoryTx,
  mergeAndSortTransactions,
} from "@/lib/chains/ronin/transactions";
import { generateAwakenCSV } from "@/lib/csv";
import { isValidRoninAddress, normalizeRoninAddress } from "@/lib/chains/ronin/utils";
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

  if (!isValidRoninAddress(address)) {
    return NextResponse.json(
      {
        error: "Invalid Ronin address format. Use 0x... or ronin:... format (40 hex characters).",
      },
      { status: 400 }
    );
  }

  const normalizedAddress = normalizeRoninAddress(address);

  try {
    const walletHistory = await fetchAllWalletHistory(normalizedAddress);

    if (walletHistory.length === 0) {
      return NextResponse.json({
        address: normalizedAddress,
        totalTransactions: 0,
        breakdown: {
          transfers: 0,
          swaps: 0,
          nfts: 0,
          staking: 0,
        },
        transactions: [],
      });
    }

    const timestamps = walletHistory.map((tx) => new Date(tx.block_timestamp).getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    const priceMap = await fetchPriceHistory(minTimestamp, maxTimestamp);

    const normalizedTxs = walletHistory.map((tx) =>
      normalizeWalletHistoryTx(tx, normalizedAddress, priceMap)
    );

    const allTransactions = mergeAndSortTransactions(normalizedTxs);

    const filtered = filterByDateRange(allTransactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    const breakdown = {
      transfers: 0,
      swaps: 0,
      nfts: 0,
      staking: 0,
      tokens: 0,
    };

    for (const tx of flagged) {
      switch (tx.type) {
        case "transfer_sent":
        case "transfer_received":
          breakdown.transfers++;
          break;
        case "swap":
          breakdown.swaps++;
          break;
        case "nft_sent":
        case "nft_received":
        case "nft_purchase":
        case "nft_sale":
          breakdown.nfts++;
          break;
        case "stake":
        case "unstake":
        case "emission_reward":
          breakdown.staking++;
          break;
        case "token_sent":
        case "token_received":
          breakdown.tokens++;
          break;
      }
    }

    if (format === "csv") {
      const csv = generateAwakenCSV(flagged);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="ronin-${normalizedAddress.slice(0, 10)}-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      address: normalizedAddress,
      totalTransactions: flagged.length,
      breakdown,
      transactions: flagged,
    });
  } catch (error) {
    console.error("Error fetching Ronin transactions:", error);
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
