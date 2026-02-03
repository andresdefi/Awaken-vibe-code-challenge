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

export const maxDuration = 120; // 2 minutes for fetching updates

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const partyId = searchParams.get("partyId");
  const format = searchParams.get("format") || "json";

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
    // Fetch latest round for balance query
    const latestRound = await fetchLatestRound();

    // Fetch wallet balance
    const balance = await fetchWalletBalance(partyId, latestRound);

    // Fetch transaction updates for this party
    const updates = await fetchAllUpdatesForParty(partyId, 2000);

    // Normalize to transactions
    const transactions = normalizeCantonUpdates(updates, partyId);

    // Calculate summary
    const summary = calculateSummary(transactions);

    // Return based on format
    if (format === "csv") {
      const csv = generateAwakenCSV(transactions);
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
      totalTransactions: transactions.length,
      summary: {
        transfers: summary.transfers,
        rewards: summary.rewards,
        totalSent: summary.totalSent,
        totalReceived: summary.totalReceived,
        totalFees: summary.totalFees,
      },
      transactions,
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
