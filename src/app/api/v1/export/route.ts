import { NextRequest, NextResponse } from "next/server";

// Supported chains and their configurations
const SUPPORTED_CHAINS: Record<string, {
  name: string;
  type: "standard" | "perps";
  requiresApiKey: boolean;
  addressFormat: string;
}> = {
  bittensor: { name: "Bittensor", type: "standard", requiresApiKey: false, addressFormat: "SS58 (starts with 5)" },
  kaspa: { name: "Kaspa", type: "standard", requiresApiKey: false, addressFormat: "kaspa:..." },
  polkadot: { name: "Polkadot", type: "standard", requiresApiKey: false, addressFormat: "SS58 (starts with 1)" },
  kusama: { name: "Kusama", type: "standard", requiresApiKey: false, addressFormat: "SS58 (starts with C, D, or F)" },
  osmosis: { name: "Osmosis", type: "standard", requiresApiKey: false, addressFormat: "osmo1..." },
  injective: { name: "Injective", type: "standard", requiresApiKey: false, addressFormat: "inj1..." },
  ronin: { name: "Ronin", type: "standard", requiresApiKey: false, addressFormat: "0x... or ronin:..." },
  hedera: { name: "Hedera", type: "standard", requiresApiKey: false, addressFormat: "0.0.xxxxx" },
  xrpl: { name: "XRP Ledger", type: "standard", requiresApiKey: false, addressFormat: "r..." },
  kava: { name: "Kava", type: "standard", requiresApiKey: false, addressFormat: "kava1..." },
  stellar: { name: "Stellar", type: "standard", requiresApiKey: false, addressFormat: "G..." },
  canton: { name: "Canton Network", type: "standard", requiresApiKey: false, addressFormat: "Participant ID" },
  multiversx: { name: "MultiversX", type: "standard", requiresApiKey: false, addressFormat: "erd1..." },
  radix: { name: "Radix", type: "standard", requiresApiKey: false, addressFormat: "account_rdx1..." },
  ergo: { name: "Ergo", type: "standard", requiresApiKey: false, addressFormat: "9..." },
  glue: { name: "Glue Network", type: "standard", requiresApiKey: false, addressFormat: "0x..." },
  dydx: { name: "dYdX v4", type: "perps", requiresApiKey: false, addressFormat: "dydx1..." },
  gmx: { name: "GMX (Arbitrum)", type: "perps", requiresApiKey: false, addressFormat: "0x..." },
  extended: { name: "Extended", type: "perps", requiresApiKey: true, addressFormat: "API Key required" },
};

interface ExportParams {
  chain: string;
  address: string;
  apiKey?: string;
  evmAddress?: string;
  format: "json" | "csv";
  startDate?: string;
  endDate?: string;
}

async function fetchFromChainAPI(params: ExportParams, baseUrl: string): Promise<Response> {
  const { chain, address, apiKey, evmAddress, format, startDate, endDate } = params;

  const chainConfig = SUPPORTED_CHAINS[chain];
  if (!chainConfig) {
    return NextResponse.json(
      { error: `Unsupported chain: ${chain}`, supportedChains: Object.keys(SUPPORTED_CHAINS) },
      { status: 400 }
    );
  }

  // Build request body based on chain requirements
  const body: Record<string, string> = { format };

  if (chainConfig.requiresApiKey) {
    if (!apiKey) {
      return NextResponse.json(
        { error: `API key required for ${chainConfig.name}` },
        { status: 400 }
      );
    }
    body.apiKey = apiKey;
  } else {
    if (!address) {
      return NextResponse.json(
        { error: `Address required for ${chainConfig.name}` },
        { status: 400 }
      );
    }
    body.address = address;
  }

  // Add optional parameters
  if (startDate) body.startDate = startDate;
  if (endDate) body.endDate = endDate;
  if (evmAddress && chain === "kava") body.evmAddress = evmAddress;

  // Call the chain-specific API
  const chainApiUrl = `${baseUrl}/api/${chain}/transactions`;

  const response = await fetch(chainApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return response;
}

// GET endpoint - unified export with query params
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chain = searchParams.get("chain");
  const address = searchParams.get("address");
  const apiKey = searchParams.get("apiKey");
  const evmAddress = searchParams.get("evmAddress");
  const format = (searchParams.get("format") || "json") as "json" | "csv";
  const startDate = searchParams.get("start") || searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("end") || searchParams.get("endDate") || undefined;

  // If no chain specified, return API documentation
  if (!chain) {
    return NextResponse.json({
      name: "Awaken CSV Export API",
      version: "1.0.0",
      description: "Unified API for exporting blockchain transaction history in Awaken Tax CSV format",
      baseUrl: "/api/v1/export",
      endpoints: {
        GET: {
          description: "Export transactions for a specific chain",
          parameters: {
            chain: "Required - Chain identifier (see supportedChains)",
            address: "Required for most chains - Wallet address",
            apiKey: "Required for Extended - API key",
            evmAddress: "Optional for Kava - EVM address for token transfers",
            format: "Optional - 'json' (default) or 'csv'",
            start: "Optional - Start date (YYYY-MM-DD)",
            end: "Optional - End date (YYYY-MM-DD)",
          },
          example: "/api/v1/export?chain=bittensor&address=5xxx&format=csv",
        },
        POST: {
          description: "Same as GET but with JSON body",
          body: {
            chain: "string",
            address: "string",
            apiKey: "string (optional)",
            format: "json | csv",
            startDate: "string (optional)",
            endDate: "string (optional)",
          },
        },
      },
      supportedChains: Object.entries(SUPPORTED_CHAINS).map(([id, config]) => ({
        id,
        name: config.name,
        type: config.type,
        requiresApiKey: config.requiresApiKey,
        addressFormat: config.addressFormat,
      })),
      csvFormats: {
        standard: {
          description: "For regular blockchain transactions",
          columns: ["Date", "Received Quantity", "Received Currency", "Received Fiat Amount", "Sent Quantity", "Sent Currency", "Sent Fiat Amount", "Fee Amount", "Fee Currency", "Transaction Hash", "Notes", "Tag"],
          documentation: "https://help.awaken.tax/en/articles/10422149-how-to-format-your-csv-for-awaken-tax",
        },
        perps: {
          description: "For perpetuals/futures trading",
          columns: ["Date", "Asset", "Amount", "Fee", "P&L", "Payment Token", "Notes", "Transaction Hash", "Tag"],
          documentation: "https://help.awaken.tax/en/articles/10453931-formatting-perpetuals-futures-csvs",
        },
      },
    });
  }

  // Validate chain
  if (!SUPPORTED_CHAINS[chain]) {
    return NextResponse.json(
      {
        error: `Unsupported chain: ${chain}`,
        supportedChains: Object.keys(SUPPORTED_CHAINS),
      },
      { status: 400 }
    );
  }

  // Get base URL from request
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  const baseUrl = `${protocol}://${host}`;

  try {
    const response = await fetchFromChainAPI(
      { chain, address: address || "", apiKey: apiKey || undefined, evmAddress: evmAddress || undefined, format, startDate, endDate },
      baseUrl
    );

    // Forward the response (CSV or JSON)
    const contentType = response.headers.get("Content-Type") || "application/json";

    if (contentType.includes("text/csv")) {
      const csv = await response.text();
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": response.headers.get("Content-Disposition") || `attachment; filename="${chain}-awaken.csv"`,
        },
      });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`Error fetching from ${chain} API:`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST endpoint - unified export with JSON body
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      chain,
      address,
      apiKey,
      evmAddress,
      format = "json",
      startDate,
      endDate,
    } = body;

    if (!chain) {
      return NextResponse.json(
        { error: "Chain parameter is required" },
        { status: 400 }
      );
    }

    if (!SUPPORTED_CHAINS[chain]) {
      return NextResponse.json(
        {
          error: `Unsupported chain: ${chain}`,
          supportedChains: Object.keys(SUPPORTED_CHAINS),
        },
        { status: 400 }
      );
    }

    // Get base URL from request
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    const response = await fetchFromChainAPI(
      { chain, address: address || "", apiKey, evmAddress, format, startDate, endDate },
      baseUrl
    );

    const contentType = response.headers.get("Content-Type") || "application/json";

    if (contentType.includes("text/csv")) {
      const csv = await response.text();
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": response.headers.get("Content-Disposition") || `attachment; filename="${chain}-awaken.csv"`,
        },
      });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error in unified export API:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
