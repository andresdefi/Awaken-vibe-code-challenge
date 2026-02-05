import { NextRequest, NextResponse } from "next/server";
import { fetchAllTransfers, getEgldPrice, getDelegation, getAccount } from "@/lib/chains/multiversx/api";
import { processTransactions } from "@/lib/chains/multiversx/transactions";
import { isValidMultiversXAddress } from "@/lib/chains/multiversx/utils";
import { generateAwakenCSV } from "@/lib/csv";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";

export const maxDuration = 120; // 2 minutes max

interface TransactionParams {
  address: string;
  format?: string;
  startDate?: string;
  endDate?: string;
  includePendingRewards?: boolean;
}

async function handleTransactions(params: TransactionParams) {
  const { address, format = "json", startDate, endDate, includePendingRewards = false } = params;

  if (!address) {
    return NextResponse.json(
      { error: "Address parameter is required" },
      { status: 400 }
    );
  }

  if (!isValidMultiversXAddress(address)) {
    return NextResponse.json(
      {
        error: "Invalid MultiversX address format",
        details: "MultiversX addresses must start with 'erd1' and be exactly 62 characters",
      },
      { status: 400 }
    );
  }

  try {
    // Verify account exists first
    await getAccount(address);

    // Convert date strings to timestamps for API filtering
    const startTimestamp = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined;
    const endTimestamp = endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined;

    // Fetch transfers, price, and delegations in parallel
    const [rawTransfers, egldPrice, delegations] = await Promise.all([
      fetchAllTransfers(address, startTimestamp, endTimestamp),
      getEgldPrice(),
      includePendingRewards ? getDelegation(address) : Promise.resolve([]),
    ]);

    // Normalize transactions
    const normalized = processTransactions(
      rawTransfers,
      address,
      egldPrice,
      includePendingRewards,
      delegations
    );

    // Apply date filter (redundant but ensures consistency)
    const filtered = filterByDateRange(normalized, { startDate, endDate });

    // Flag ambiguous transactions
    const flagged = flagAmbiguousTransactions(filtered);

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenCSV(flagged);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="multiversx-${address.slice(0, 16)}-awaken.csv"`,
        },
      });
    }

    // Calculate summary
    const summary = {
      totalTransactions: flagged.length,
      sent: flagged.filter((tx) => tx.type === "transfer_sent" || tx.type === "token_sent").length,
      received: flagged.filter((tx) => tx.type === "transfer_received" || tx.type === "token_received").length,
      staking: flagged.filter((tx) => tx.type === "stake" || tx.type === "unstake").length,
      rewards: flagged.filter((tx) => tx.type === "emission_reward").length,
      totalFees: flagged.reduce((sum, tx) => sum + tx.feeAmount, 0),
    };

    return NextResponse.json({
      address,
      transactions: flagged,
      summary,
    });
  } catch (error) {
    console.error("Error fetching MultiversX transactions:", error);

    // Handle account not found specifically
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          error: "Account not found",
          details: "This address has no activity on MultiversX mainnet",
        },
        { status: 404 }
      );
    }

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
    startDate: searchParams.get("start") || undefined,
    endDate: searchParams.get("end") || undefined,
    includePendingRewards: searchParams.get("includePending") === "true",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleTransactions({
    address: body.address || "",
    format: body.format || "json",
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
    includePendingRewards: body.includePendingRewards || false,
  });
}
