import { NextRequest, NextResponse } from "next/server";
import { fetchAllTransactions, fetchTokenTransfers, getGluePrice, verifyAddress } from "@/lib/chains/glue/api";
import { processTransactions } from "@/lib/chains/glue/transactions";
import { isValidGlueAddress } from "@/lib/chains/glue/utils";
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

  if (!isValidGlueAddress(address)) {
    return NextResponse.json(
      {
        error: "Invalid Glue address format",
        details: "Glue addresses are EVM-compatible and start with '0x' followed by 40 hex characters",
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
          details: "This address has no activity on the Glue network",
        },
        { status: 404 }
      );
    }

    // Fetch transactions, token transfers, and price in parallel
    const [rawTransactions, tokenTransfers, gluePrice] = await Promise.all([
      fetchAllTransactions(address),
      fetchTokenTransfers(address),
      getGluePrice(),
    ]);

    // Normalize transactions
    const normalized = processTransactions(rawTransactions, tokenTransfers, address, gluePrice);

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
          "Content-Disposition": `attachment; filename="glue-${address.slice(0, 10)}-awaken.csv"`,
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
    console.error("Error fetching Glue transactions:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          error: "Address not found",
          details: "This address has no activity on the Glue network",
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
