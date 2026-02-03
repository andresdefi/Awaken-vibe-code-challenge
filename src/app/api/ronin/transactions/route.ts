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
import type { NormalizedTransaction } from "@/lib/types";

export const maxDuration = 120; // 2 minutes for large wallets

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
    // Fetch wallet history from Moralis
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

    // Get date range for price history
    const timestamps = walletHistory.map((tx) => new Date(tx.block_timestamp).getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    // Fetch RON price history
    const priceMap = await fetchPriceHistory(minTimestamp, maxTimestamp);

    // Normalize all transactions
    const normalizedTxs = walletHistory.map((tx) =>
      normalizeWalletHistoryTx(tx, normalizedAddress, priceMap)
    );

    // Merge and sort
    const allTransactions = mergeAndSortTransactions(normalizedTxs);

    // Calculate breakdown
    const breakdown = {
      transfers: 0,
      swaps: 0,
      nfts: 0,
      staking: 0,
      tokens: 0,
    };

    for (const tx of allTransactions) {
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

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenCSV(allTransactions);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="ronin-${normalizedAddress.slice(0, 10)}-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      address: normalizedAddress,
      totalTransactions: allTransactions.length,
      breakdown,
      transactions: allTransactions,
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
