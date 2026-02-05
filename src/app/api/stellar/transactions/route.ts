import { NextResponse } from "next/server";
import {
  isValidStellarAddress,
  normalizeAddress,
  fetchAccountInfo,
  fetchAllOperations,
} from "@/lib/chains/stellar/api";
import {
  normalizeStellarOperations,
  calculateSummary,
} from "@/lib/chains/stellar/transactions";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, startDate, endDate } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Stellar address is required" },
        { status: 400 }
      );
    }

    const stellarAddress = normalizeAddress(address);

    if (!isValidStellarAddress(stellarAddress)) {
      return NextResponse.json(
        {
          error: "Invalid Stellar address format",
          details:
            "Stellar addresses start with 'G' followed by 55 uppercase alphanumeric characters (e.g., GCZST3XVCDTUJ76ZAV2HA72KYPRPMK5V54ZFZAKBNRVVVBXJSKHVD6ZT)",
        },
        { status: 400 }
      );
    }

    const accountInfo = await fetchAccountInfo(stellarAddress);

    if (!accountInfo) {
      return NextResponse.json(
        {
          error: "Account not found",
          details: `No Stellar account found with address ${stellarAddress}. The account may not be activated (requires minimum 1 XLM reserve).`,
        },
        { status: 404 }
      );
    }

    console.log(`Fetching operations for Stellar account ${stellarAddress}...`);
    const rawOperations = await fetchAllOperations(stellarAddress);

    console.log(`Found ${rawOperations.length} raw operations`);

    const transactions = await normalizeStellarOperations(
      rawOperations,
      stellarAddress
    );

    console.log(`Normalized to ${transactions.length} transactions`);

    const filtered = filterByDateRange(transactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    const summary = calculateSummary(flagged);

    return NextResponse.json({
      transactions: flagged,
      summary,
      address: stellarAddress,
    });
  } catch (error) {
    console.error("Stellar API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
