import { NextRequest, NextResponse } from "next/server";
import { fetchAllTransactions, getXrdPrice, verifyAccount } from "@/lib/chains/radix/api";
import { processTransactions } from "@/lib/chains/radix/transactions";
import { isValidRadixAddress } from "@/lib/chains/radix/utils";
import { generateAwakenCSV } from "@/lib/csv";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";

export const maxDuration = 120; // 2 minutes max

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

  if (!isValidRadixAddress(address)) {
    return NextResponse.json(
      {
        error: "Invalid Radix address format",
        details: "Radix account addresses must start with 'account_rdx1' followed by Bech32m-encoded data",
      },
      { status: 400 }
    );
  }

  try {
    // Verify account exists
    const accountExists = await verifyAccount(address);
    if (!accountExists) {
      return NextResponse.json(
        {
          error: "Account not found",
          details: "This address has no activity on Radix mainnet",
        },
        { status: 404 }
      );
    }

    // Parse date filters
    const fromDate = startDate ? new Date(startDate) : undefined;
    const toDate = endDate ? new Date(endDate) : undefined;

    // Fetch transactions and price in parallel
    const [rawTransactions, xrdPrice] = await Promise.all([
      fetchAllTransactions(address, fromDate, toDate),
      getXrdPrice(),
    ]);

    // Normalize transactions
    const normalized = processTransactions(rawTransactions, address, xrdPrice);

    // Apply date filter (for consistency with other chains)
    const filtered = filterByDateRange(normalized, { startDate, endDate });

    // Flag ambiguous transactions
    const flagged = flagAmbiguousTransactions(filtered);

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenCSV(flagged);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="radix-${address.slice(0, 20)}-awaken.csv"`,
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
      swaps: flagged.filter((tx) => tx.type === "swap").length,
      totalFees: flagged.reduce((sum, tx) => sum + tx.feeAmount, 0),
    };

    return NextResponse.json({
      address,
      transactions: flagged,
      summary,
    });
  } catch (error) {
    console.error("Error fetching Radix transactions:", error);

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
