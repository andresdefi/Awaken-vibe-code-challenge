import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllTrades,
  fetchAllFundingPayments,
  fetchAllAssetOperations,
  validateApiKey,
} from "@/lib/chains/extended/api";
import {
  normalizeExtendedData,
  calculateSummary,
} from "@/lib/chains/extended/transactions";
import { generateAwakenPerpsCSV } from "@/lib/csv";

export const maxDuration = 120; // 2 minutes for accounts with lots of trades

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, format = "json" } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Validate API key
    const isValid = await validateApiKey(apiKey);
    if (!isValid) {
      return NextResponse.json(
        {
          error: "Invalid API key",
          details: "The API key could not be validated. Please check your Extended API key and try again.",
        },
        { status: 401 }
      );
    }

    // Fetch all data in parallel
    const [trades, fundingPayments, assetOperations] = await Promise.all([
      fetchAllTrades(apiKey),
      fetchAllFundingPayments(apiKey),
      fetchAllAssetOperations(apiKey),
    ]);

    // Normalize to Perps transactions
    const transactions = normalizeExtendedData(
      trades,
      fundingPayments,
      assetOperations
    );

    // Calculate summary
    const summary = calculateSummary(transactions);

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenPerpsCSV(transactions);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="extended-perps-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      totalTransactions: transactions.length,
      summary: {
        totalTrades: summary.totalTrades,
        openPositions: summary.openPositions,
        closePositions: summary.closePositions,
        fundingPayments: summary.fundingPayments,
        totalPnL: summary.totalPnL,
        totalFees: summary.totalFees,
        tradedAssets: summary.tradedAssets,
      },
      transactions,
    });
  } catch (error) {
    console.error("Error fetching Extended transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for simple health check / info
export async function GET() {
  return NextResponse.json({
    chain: "Extended",
    description: "Starknet-based perpetuals DEX",
    requirements: {
      apiKey: "Required - Create at extended.exchange",
      starkKey: "Not required for read-only access",
    },
    supportedData: [
      "Trade history (opens, closes, liquidations)",
      "Funding payments",
      "Deposits and withdrawals",
    ],
    csvFormat: "Awaken Perps CSV format",
    documentation: "https://api.docs.extended.exchange/",
  });
}
