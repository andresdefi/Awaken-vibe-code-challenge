import { NextResponse } from "next/server";
import {
  isValidAccountId,
  normalizeAccountId,
  fetchAccountInfo,
  fetchAllTransactions,
} from "@/lib/chains/hedera/api";
import {
  normalizeHederaTransactions,
  calculateSummary,
} from "@/lib/chains/hedera/transactions";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Normalize the account ID
    const accountId = normalizeAccountId(address);

    // Validate account ID format
    if (!isValidAccountId(accountId)) {
      return NextResponse.json(
        {
          error: "Invalid Hedera account ID format",
          details: "Account ID should be in format 0.0.xxxxx (e.g., 0.0.12345)",
        },
        { status: 400 }
      );
    }

    // Verify account exists
    const accountExists = await fetchAccountInfo(accountId);

    if (!accountExists) {
      return NextResponse.json(
        {
          error: "Account not found",
          details: `No Hedera account found with ID ${accountId}`,
        },
        { status: 404 }
      );
    }

    // Fetch all transactions
    console.log(`Fetching transactions for Hedera account ${accountId}...`);
    const rawTransactions = await fetchAllTransactions(accountId);

    console.log(`Found ${rawTransactions.length} raw transactions`);

    // Normalize transactions
    const transactions = await normalizeHederaTransactions(
      rawTransactions,
      accountId
    );

    console.log(`Normalized to ${transactions.length} transactions`);

    // Calculate summary
    const summary = calculateSummary(transactions);

    return NextResponse.json({
      transactions,
      summary,
      accountId,
    });
  } catch (error) {
    console.error("Hedera API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
