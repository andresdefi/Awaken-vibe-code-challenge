import { NextRequest, NextResponse } from "next/server";
import { fetchAllTransactions, getErgPrice, verifyAddress } from "@/lib/chains/ergo/api";
import { processTransactions } from "@/lib/chains/ergo/transactions";
import { isValidErgoAddress } from "@/lib/chains/ergo/utils";
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

  if (!isValidErgoAddress(address)) {
    return NextResponse.json(
      {
        error: "Invalid Ergo address format",
        details: "Ergo mainnet addresses are Base58-encoded and typically start with '9' (P2PK), '8' (P2SH), or other prefixes",
      },
      { status: 400 }
    );
  }

  try {
    // Verify address exists
    const addressExists = await verifyAddress(address);
    if (!addressExists) {
      return NextResponse.json(
        {
          error: "Address not found",
          details: "This address has no activity on the Ergo network",
        },
        { status: 404 }
      );
    }

    // Fetch transactions and price in parallel
    const [rawTransactions, ergPrice] = await Promise.all([
      fetchAllTransactions(address),
      getErgPrice(),
    ]);

    // Normalize transactions
    const normalized = processTransactions(rawTransactions, address, ergPrice);

    // Apply date filter
    const filtered = filterByDateRange(normalized, { startDate, endDate });

    // Flag ambiguous transactions
    const flagged = flagAmbiguousTransactions(filtered);

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenCSV(flagged);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="ergo-${address.slice(0, 12)}-awaken.csv"`,
        },
      });
    }

    // Calculate summary
    const summary = {
      totalTransactions: flagged.length,
      sent: flagged.filter((tx) => tx.type === "transfer_sent" || tx.type === "token_sent").length,
      received: flagged.filter((tx) => tx.type === "transfer_received" || tx.type === "token_received").length,
      totalFees: flagged.reduce((sum, tx) => sum + tx.feeAmount, 0),
    };

    return NextResponse.json({
      address,
      transactions: flagged,
      summary,
    });
  } catch (error) {
    console.error("Error fetching Ergo transactions:", error);

    // Handle address not found specifically
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          error: "Address not found",
          details: "This address has no activity on the Ergo network",
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
