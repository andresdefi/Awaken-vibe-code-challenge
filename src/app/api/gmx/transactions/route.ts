import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllDataForAddress,
  validateAddress,
} from "@/lib/chains/gmx/api";
import {
  normalizeGmxData,
  calculateSummary,
} from "@/lib/chains/gmx/transactions";
import { generateAwakenPerpsCSV } from "@/lib/csv";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousPerpsTransactions } from "@/lib/ambiguous";

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
      { error: "Address is required" },
      { status: 400 }
    );
  }

  if (!validateAddress(address)) {
    return NextResponse.json(
      {
        error: "Invalid address format",
        details: "GMX uses Ethereum addresses. Must be a 42-character hex address starting with 0x.",
      },
      { status: 400 }
    );
  }

  try {
    const timestampStart = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined;
    const timestampEnd = endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined;

    const { tradeActions, claimActions } = await fetchAllDataForAddress(
      address,
      timestampStart,
      timestampEnd
    );

    if (tradeActions.length === 0 && claimActions.length === 0) {
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
        },
        transactions: [],
        message: "No trading activity found for this address on GMX V2 (Arbitrum).",
      });
    }

    const transactions = normalizeGmxData(tradeActions, claimActions);

    // Apply date filter and ambiguous flagging
    const filtered = filterByDateRange(transactions, { startDate, endDate });
    const flagged = flagAmbiguousPerpsTransactions(filtered);

    const summary = calculateSummary(flagged);

    if (format === "csv") {
      const csv = generateAwakenPerpsCSV(flagged);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="gmx-perps-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      totalTransactions: flagged.length,
      summary: {
        totalTrades: summary.totalTrades,
        openPositions: summary.openPositions,
        closePositions: summary.closePositions,
        fundingPayments: summary.fundingPayments,
        totalPnL: summary.totalPnL,
        totalFees: summary.totalFees,
        tradedAssets: summary.tradedAssets,
      },
      transactions: flagged,
    });
  } catch (error) {
    console.error("Error fetching GMX transactions:", error);
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
  const address = searchParams.get("address");

  if (!address) {
    // Return API info if no address provided
    return NextResponse.json({
      chain: "GMX V2 (Arbitrum)",
      description: "Decentralized perpetuals exchange on Arbitrum",
      requirements: {
        address: "Required - Ethereum wallet address (0x...)",
        apiKey: "Not required - uses public Subsquid indexer",
      },
      supportedData: [
        "Trade history (opens, closes, liquidations)",
        "Funding fee claims",
        "Position P&L including price impact",
        "Trading fees (position, funding, borrowing)",
      ],
      csvFormat: "Awaken Perps CSV format",
      documentation: "https://docs.gmx.io/",
      markets: "BTC, ETH, SOL, ARB, DOGE, LTC, LINK, UNI, XRP, NEAR, ATOM, AAVE, AVAX, OP, GMX, PEPE, WIF, SHIB, and more",
    });
  }

  return handleTransactions({
    address,
    format: searchParams.get("format") || "json",
    startDate: searchParams.get("start") || undefined,
    endDate: searchParams.get("end") || undefined,
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
