import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllDataForAddress,
  validateAddress,
} from "@/lib/chains/dydx/api";
import {
  normalizeDydxData,
  calculateSummary,
} from "@/lib/chains/dydx/transactions";
import { generateAwakenPerpsCSV } from "@/lib/csv";

export const maxDuration = 120; // 2 minutes for accounts with lots of trades

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, format = "json" } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!validateAddress(address)) {
      return NextResponse.json(
        {
          error: "Invalid address format",
          details: "dYdX v4 addresses must start with 'dydx1' and be 43 characters long.",
        },
        { status: 400 }
      );
    }

    // Fetch all data for the address
    const { fills, transfers, fundingPayments, subaccounts } = await fetchAllDataForAddress(address);

    // Check if account exists
    if (subaccounts.length === 0) {
      return NextResponse.json({
        totalTransactions: 0,
        summary: {
          totalTrades: 0,
          openPositions: 0,
          closePositions: 0,
          fundingPayments: 0,
          totalPnL: 0,
          totalFees: 0,
          tradedAssets: [],
          subaccounts: 0,
        },
        transactions: [],
        message: "No subaccounts found for this address. The address may not have any trading activity on dYdX v4.",
      });
    }

    // Normalize to Perps transactions
    const transactions = normalizeDydxData(
      fills,
      fundingPayments,
      transfers
    );

    // Calculate summary
    const summary = calculateSummary(transactions, subaccounts.length);

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenPerpsCSV(transactions);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="dydx-perps-awaken.csv"`,
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
        subaccounts: summary.subaccounts,
      },
      transactions,
    });
  } catch (error) {
    console.error("Error fetching dYdX transactions:", error);
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
    chain: "dYdX v4",
    description: "Cosmos-based perpetuals DEX",
    requirements: {
      address: "Required - dYdX wallet address (dydx1...)",
      apiKey: "Not required - uses public indexer",
    },
    supportedData: [
      "Trade history (opens, closes, liquidations)",
      "Funding payments",
      "Deposits and withdrawals",
    ],
    csvFormat: "Awaken Perps CSV format",
    documentation: "https://docs.dydx.exchange/api_integration-indexer/indexer_api",
  });
}
