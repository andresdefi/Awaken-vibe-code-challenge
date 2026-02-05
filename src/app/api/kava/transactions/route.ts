import { NextResponse } from "next/server";
import {
  isValidKavaAddress,
  isValidEvmAddress,
  normalizeAddress,
  fetchAccountInfo,
  fetchAllTransactions,
} from "@/lib/chains/kava/api";
import {
  normalizeKavaTransactions,
  calculateSummary,
} from "@/lib/chains/kava/transactions";
import { filterByDateRange } from "@/lib/date-filter";
import { flagAmbiguousTransactions } from "@/lib/ambiguous";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, evmAddress, startDate, endDate } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Kava address is required" },
        { status: 400 }
      );
    }

    const kavaAddress = normalizeAddress(address);

    if (!isValidKavaAddress(kavaAddress)) {
      return NextResponse.json(
        {
          error: "Invalid Kava address format",
          details:
            "Kava addresses start with 'kava1' followed by 38 alphanumeric characters (e.g., kava1abc123...)",
        },
        { status: 400 }
      );
    }

    let validatedEvmAddress: string | null = null;
    if (evmAddress) {
      const normalizedEvmAddress = evmAddress.trim().toLowerCase();
      if (isValidEvmAddress(normalizedEvmAddress)) {
        validatedEvmAddress = normalizedEvmAddress;
      } else {
        console.warn(`Invalid EVM address provided: ${evmAddress}, skipping EVM transactions`);
      }
    }

    const accountExists = await fetchAccountInfo(kavaAddress);

    if (!accountExists) {
      return NextResponse.json(
        {
          error: "Account not found",
          details: `No Kava account found with address ${kavaAddress}. The account may not have any transactions yet.`,
        },
        { status: 404 }
      );
    }

    console.log(`Fetching transactions for Kava account ${kavaAddress}...`);
    if (validatedEvmAddress) {
      console.log(`Also fetching EVM transactions for ${validatedEvmAddress}...`);
    }

    const { cosmos, evmTransfers } = await fetchAllTransactions(
      kavaAddress,
      validatedEvmAddress || undefined
    );

    console.log(`Found ${cosmos.length} Cosmos transactions and ${evmTransfers.length} EVM transfers`);

    const transactions = await normalizeKavaTransactions(
      cosmos,
      evmTransfers,
      kavaAddress,
      validatedEvmAddress
    );

    console.log(`Normalized to ${transactions.length} transactions`);

    const filtered = filterByDateRange(transactions, { startDate, endDate });
    const flagged = flagAmbiguousTransactions(filtered);

    const summary = calculateSummary(flagged);

    return NextResponse.json({
      transactions: flagged,
      summary,
      address: kavaAddress,
      evmAddress: validatedEvmAddress,
    });
  } catch (error) {
    console.error("Kava API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
