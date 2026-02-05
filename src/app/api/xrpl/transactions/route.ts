import { NextResponse } from "next/server";
import {
  isValidXRPAddress,
  normalizeAddress,
  fetchAccountInfo,
  fetchAllTransactions,
} from "@/lib/chains/xrpl/api";
import {
  normalizeXRPLTransactions,
  calculateSummary,
} from "@/lib/chains/xrpl/transactions";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, startDate, endDate } = body;

    if (!address) {
      return NextResponse.json(
        { error: "XRP address is required" },
        { status: 400 }
      );
    }

    const xrpAddress = normalizeAddress(address);

    if (!isValidXRPAddress(xrpAddress)) {
      return NextResponse.json(
        {
          error: "Invalid XRP address format",
          details:
            "XRP addresses start with 'r' followed by 24-34 alphanumeric characters (e.g., rN7n3473SaZBCG4dFL83w7a1RXtXtbDK8d)",
        },
        { status: 400 }
      );
    }

    const accountExists = await fetchAccountInfo(xrpAddress);

    if (!accountExists) {
      return NextResponse.json(
        {
          error: "Account not found",
          details: `No XRP Ledger account found with address ${xrpAddress}. The account may not be activated (requires minimum 10 XRP reserve).`,
        },
        { status: 404 }
      );
    }

    console.log(`Fetching transactions for XRP account ${xrpAddress}...`);
    const rawTransactions = await fetchAllTransactions(xrpAddress);

    console.log(`Found ${rawTransactions.length} raw transactions`);

    const transactions = await normalizeXRPLTransactions(
      rawTransactions,
      xrpAddress
    );

    console.log(`Normalized to ${transactions.length} transactions`);

    const filtered = filterByDateRange(transactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    const summary = calculateSummary(flagged);

    return NextResponse.json({
      transactions: flagged,
      summary,
      address: xrpAddress,
    });
  } catch (error) {
    console.error("XRPL API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
