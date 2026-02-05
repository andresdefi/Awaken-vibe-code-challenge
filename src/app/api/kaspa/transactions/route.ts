import { NextRequest, NextResponse } from "next/server";
import { fetchAllTransactions, fetchKaspaPrice } from "@/lib/chains/kaspa/api";
import { processTransactions } from "@/lib/chains/kaspa/transactions";
import { isValidKaspaAddress } from "@/lib/chains/kaspa/utils";
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

  if (!isValidKaspaAddress(address)) {
    return NextResponse.json(
      {
        error: "Invalid Kaspa address format",
        details: "Kaspa addresses must start with 'kaspa:' followed by a bech32-encoded payload",
      },
      { status: 400 }
    );
  }

  try {
    // Fetch transactions and price in parallel
    const [rawTransactions, kasPrice] = await Promise.all([
      fetchAllTransactions(address),
      fetchKaspaPrice(),
    ]);

    // Normalize transactions
    const normalized = processTransactions(rawTransactions, address, kasPrice);

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
          "Content-Disposition": `attachment; filename="kaspa-${address.slice(0, 16)}-awaken.csv"`,
        },
      });
    }

    // Calculate summary
    const summary = {
      totalTransactions: flagged.length,
      sent: flagged.filter((tx) => tx.type === "transfer_sent").length,
      received: flagged.filter((tx) => tx.type === "transfer_received").length,
      totalFees: flagged.reduce((sum, tx) => sum + tx.feeAmount, 0),
    };

    return NextResponse.json({
      address,
      transactions: flagged,
      summary,
    });
  } catch (error) {
    console.error("Error fetching Kaspa transactions:", error);
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
