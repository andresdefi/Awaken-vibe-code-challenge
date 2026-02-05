import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllUpdatesForParty,
  fetchWalletBalance,
  fetchLatestRound,
  isValidPartyId,
} from "@/lib/chains/canton/api";
import {
  normalizeCantonUpdates,
  calculateSummary,
} from "@/lib/chains/canton/transactions";
import { generateAwakenCSV } from "@/lib/csv";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";

export const maxDuration = 120;

interface TransactionParams {
  partyId: string;
  format?: string;
  startDate?: string;
  endDate?: string;
}

async function handleTransactions(params: TransactionParams) {
  const { partyId, format = "json", startDate, endDate } = params;

  if (!partyId) {
    return NextResponse.json(
      { error: "Party ID parameter is required" },
      { status: 400 }
    );
  }

  if (!isValidPartyId(partyId)) {
    return NextResponse.json(
      {
        error: "Invalid Canton Party ID format",
        details: "Party ID should be in format: hint::hash (e.g., MyWallet::1220abc...)",
      },
      { status: 400 }
    );
  }

  try {
    const latestRound = await fetchLatestRound();
    const balance = await fetchWalletBalance(partyId, latestRound);
    const updates = await fetchAllUpdatesForParty(partyId, 2000);

    const transactions = normalizeCantonUpdates(updates, partyId);

    const filtered = filterByDateRange(transactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    const summary = calculateSummary(flagged);

    if (format === "csv") {
      const csv = generateAwakenCSV(flagged);
      const partyHint = partyId.split("::")[0] || "canton";
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="canton-${partyHint}-awaken.csv"`,
        },
      });
    }

    return NextResponse.json({
      partyId,
      latestRound,
      balance: balance
        ? {
            unlockedBalance: balance.effective_unlocked_qty,
            lockedBalance: balance.effective_locked_qty,
            holdingFees: balance.total_holding_fees,
          }
        : null,
      totalTransactions: flagged.length,
      summary: {
        transfers: summary.transfers,
        rewards: summary.rewards,
        totalSent: summary.totalSent,
        totalReceived: summary.totalReceived,
        totalFees: summary.totalFees,
      },
      transactions: flagged,
    });
  } catch (error) {
    console.error("Error fetching Canton transactions:", error);
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
    partyId: searchParams.get("partyId") || "",
    format: searchParams.get("format") || "json",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return handleTransactions({
    partyId: body.address || body.partyId || "",
    format: body.format || "json",
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
  });
}
