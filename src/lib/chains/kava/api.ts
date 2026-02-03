// Kava API Client - Cosmos SDK + EVM Support

import {
  type KavaTxResponse,
  type KavaTxSearchResponse,
  type CosmosCoin,
  type EVMTransaction,
  type EVMTokenTransfer,
  KAVA_REST_API,
  KAVA_EVM_RPC,
  KAVA_TOKENS,
  IBC_DENOMS,
  EVM_TOKENS,
  UKAVA_PER_KAVA,
} from "./types";

// Rate limiter for Kava API
// Cosmos: 100 req/5min for archive = ~0.33 req/sec
// EVM: More lenient but we stay conservative
const COSMOS_RATE_LIMIT_DELAY = 200; // ms between Cosmos requests
const EVM_RATE_LIMIT_DELAY = 100; // ms between EVM requests
let lastCosmosRequestTime = 0;
let lastEvmRequestTime = 0;

async function rateLimitedCosmosFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastCosmosRequestTime;

  if (timeSinceLastRequest < COSMOS_RATE_LIMIT_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, COSMOS_RATE_LIMIT_DELAY - timeSinceLastRequest)
    );
  }

  lastCosmosRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  return response;
}

async function rateLimitedEvmFetch(
  method: string,
  params: unknown[]
): Promise<unknown> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastEvmRequestTime;

  if (timeSinceLastRequest < EVM_RATE_LIMIT_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, EVM_RATE_LIMIT_DELAY - timeSinceLastRequest)
    );
  }

  lastEvmRequestTime = Date.now();

  const response = await fetch(KAVA_EVM_RPC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`EVM RPC error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`EVM RPC error: ${data.error.message}`);
  }

  return data.result;
}

// Validate Kava Cosmos address format (kava1...)
export function isValidKavaAddress(address: string): boolean {
  const pattern = /^kava1[a-z0-9]{38}$/;
  return pattern.test(address);
}

// Validate Kava EVM address format (0x...)
export function isValidEvmAddress(address: string): boolean {
  const pattern = /^0x[a-fA-F0-9]{40}$/;
  return pattern.test(address);
}

// Normalize address input
export function normalizeAddress(input: string): string {
  return input.trim().toLowerCase();
}

// Convert Kava bech32 address to EVM address
// This is a simplified version - in production you'd use proper bech32 decoding
export function cosmosToEvmAddress(kavaAddress: string): string | null {
  // This would require proper bech32 decoding
  // For now, we'll fetch the EVM address from the account info
  return null;
}

// Check if Cosmos account exists on the chain
export async function fetchAccountInfo(address: string): Promise<boolean> {
  const url = `${KAVA_REST_API}/cosmos/auth/v1beta1/accounts/${address}`;

  try {
    const response = await rateLimitedCosmosFetch(url);

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.message?.includes("not found")) {
        return false;
      }
      throw new Error(`Kava API error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error("Error checking account:", error);
    throw error;
  }
}

// Fetch EVM address associated with Cosmos address
export async function fetchEvmAddressForCosmos(
  kavaAddress: string
): Promise<string | null> {
  try {
    const url = `${KAVA_REST_API}/kava/evmutil/v1beta1/params`;
    const response = await rateLimitedCosmosFetch(url);

    if (!response.ok) {
      return null;
    }

    // The actual conversion requires the account's public key
    // For now, we'll try to get it from account info
    const accountUrl = `${KAVA_REST_API}/cosmos/auth/v1beta1/accounts/${kavaAddress}`;
    const accountResponse = await rateLimitedCosmosFetch(accountUrl);

    if (!accountResponse.ok) {
      return null;
    }

    const accountData = await accountResponse.json();
    const account = accountData.account;

    // Check if this is an EthAccount (has eth_address field)
    if (account?.["@type"]?.includes("EthAccount") && account?.base_account) {
      // Some Kava accounts expose the EVM address directly
      return account.address || null;
    }

    return null;
  } catch {
    return null;
  }
}

// Fetch transactions where account is sender (Cosmos)
async function fetchSentTransactions(
  address: string,
  paginationKey?: string
): Promise<{ txs: KavaTxResponse[]; nextKey: string | null }> {
  let url = `${KAVA_REST_API}/cosmos/tx/v1beta1/txs?events=message.sender='${address}'&order_by=ORDER_BY_DESC&pagination.limit=100`;

  if (paginationKey) {
    url += `&pagination.key=${encodeURIComponent(paginationKey)}`;
  }

  const response = await rateLimitedCosmosFetch(url);

  if (!response.ok) {
    // Check if it's a rate limit error
    if (response.status === 429) {
      console.warn("Rate limited on Kava API, waiting...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return fetchSentTransactions(address, paginationKey);
    }

    const errorText = await response.text();
    throw new Error(`Kava API error (${response.status}): ${errorText}`);
  }

  const data: KavaTxSearchResponse = await response.json();

  return {
    txs: data.tx_responses || [],
    nextKey: data.pagination?.next_key || null,
  };
}

// Fetch transactions where account is recipient (Cosmos)
async function fetchReceivedTransactions(
  address: string,
  paginationKey?: string
): Promise<{ txs: KavaTxResponse[]; nextKey: string | null }> {
  let url = `${KAVA_REST_API}/cosmos/tx/v1beta1/txs?events=transfer.recipient='${address}'&order_by=ORDER_BY_DESC&pagination.limit=100`;

  if (paginationKey) {
    url += `&pagination.key=${encodeURIComponent(paginationKey)}`;
  }

  const response = await rateLimitedCosmosFetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      console.warn("Rate limited on Kava API, waiting...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return fetchReceivedTransactions(address, paginationKey);
    }
    return { txs: [], nextKey: null };
  }

  const data: KavaTxSearchResponse = await response.json();

  return {
    txs: data.tx_responses || [],
    nextKey: data.pagination?.next_key || null,
  };
}

// Fetch all Cosmos transactions for an account
export async function fetchAllCosmosTransactions(
  address: string,
  onProgress?: (count: number, type: string) => void
): Promise<KavaTxResponse[]> {
  const allTransactions: KavaTxResponse[] = [];
  const seenHashes = new Set<string>();
  const maxTransactions = 10000;

  // Fetch sent transactions
  let sentNextKey: string | null = null;
  let hasMoreSent = true;
  let retryCount = 0;
  const maxRetries = 3;

  while (hasMoreSent && allTransactions.length < maxTransactions) {
    try {
      const { txs, nextKey } = await fetchSentTransactions(
        address,
        sentNextKey || undefined
      );

      for (const tx of txs) {
        if (!seenHashes.has(tx.txhash) && tx.code === 0) {
          seenHashes.add(tx.txhash);
          allTransactions.push(tx);
        }
      }

      if (onProgress) {
        onProgress(allTransactions.length, "Cosmos sent");
      }

      sentNextKey = nextKey;
      hasMoreSent = !!nextKey && txs.length === 100;
      retryCount = 0; // Reset retry count on success
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        console.error("Max retries reached for sent transactions:", error);
        hasMoreSent = false;
      } else {
        console.warn(`Retry ${retryCount}/${maxRetries} for sent transactions`);
        await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
      }
    }
  }

  // Fetch received transactions
  let recvNextKey: string | null = null;
  let hasMoreRecv = true;
  retryCount = 0;

  while (hasMoreRecv && allTransactions.length < maxTransactions) {
    try {
      const { txs, nextKey } = await fetchReceivedTransactions(
        address,
        recvNextKey || undefined
      );

      for (const tx of txs) {
        if (!seenHashes.has(tx.txhash) && tx.code === 0) {
          seenHashes.add(tx.txhash);
          allTransactions.push(tx);
        }
      }

      if (onProgress) {
        onProgress(allTransactions.length, "Cosmos received");
      }

      recvNextKey = nextKey;
      hasMoreRecv = !!nextKey && txs.length === 100;
      retryCount = 0;
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        console.error("Max retries reached for received transactions:", error);
        hasMoreRecv = false;
      } else {
        console.warn(`Retry ${retryCount}/${maxRetries} for received transactions`);
        await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
      }
    }
  }

  if (allTransactions.length >= maxTransactions) {
    console.warn(`Reached ${maxTransactions} Cosmos transactions limit for ${address}`);
  }

  return allTransactions;
}

// Fetch EVM transactions for an address
export async function fetchEvmTransactions(
  evmAddress: string,
  onProgress?: (count: number) => void
): Promise<EVMTransaction[]> {
  const transactions: EVMTransaction[] = [];

  try {
    // Get the latest block number
    const latestBlock = (await rateLimitedEvmFetch(
      "eth_blockNumber",
      []
    )) as string;
    const latestBlockNum = parseInt(latestBlock, 16);

    // We'll scan blocks in chunks (this is a simplified approach)
    // A more robust solution would use an indexer like Kavascan API
    const blocksToScan = Math.min(10000, latestBlockNum);
    const startBlock = latestBlockNum - blocksToScan;

    // Get transaction count to see if there are any transactions
    const txCount = (await rateLimitedEvmFetch("eth_getTransactionCount", [
      evmAddress,
      "latest",
    ])) as string;

    if (parseInt(txCount, 16) === 0) {
      return [];
    }

    // For EVM transactions, we'd ideally use an indexer API
    // The JSON-RPC doesn't have a direct "get transactions by address" method
    // We'll note this limitation and return what we can get

    if (onProgress) {
      onProgress(transactions.length);
    }
  } catch (error) {
    console.error("Error fetching EVM transactions:", error);
  }

  return transactions;
}

// Fetch EVM token transfers using logs
export async function fetchEvmTokenTransfers(
  evmAddress: string,
  onProgress?: (count: number) => void
): Promise<EVMTokenTransfer[]> {
  const transfers: EVMTokenTransfer[] = [];

  try {
    // ERC-20 Transfer event signature
    const transferTopic =
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    // Pad address to 32 bytes for topic matching
    const paddedAddress = "0x" + evmAddress.slice(2).padStart(64, "0");

    // Get logs for transfers TO this address
    const toLogsResult = await rateLimitedEvmFetch("eth_getLogs", [
      {
        fromBlock: "0x0",
        toBlock: "latest",
        topics: [transferTopic, null, paddedAddress],
      },
    ]);

    const toLogs = toLogsResult as Array<{
      transactionHash: string;
      blockNumber: string;
      data: string;
      topics: string[];
      address: string;
    }>;

    // Get logs for transfers FROM this address
    const fromLogsResult = await rateLimitedEvmFetch("eth_getLogs", [
      {
        fromBlock: "0x0",
        toBlock: "latest",
        topics: [transferTopic, paddedAddress, null],
      },
    ]);

    const fromLogs = fromLogsResult as Array<{
      transactionHash: string;
      blockNumber: string;
      data: string;
      topics: string[];
      address: string;
    }>;

    // Combine and deduplicate
    const allLogs = [...toLogs, ...fromLogs];
    const seenHashes = new Set<string>();

    for (const log of allLogs) {
      if (seenHashes.has(log.transactionHash)) continue;
      seenHashes.add(log.transactionHash);

      const tokenAddress = log.address.toLowerCase();
      const tokenInfo = EVM_TOKENS[tokenAddress] || {
        symbol: "UNKNOWN",
        decimals: 18,
        coingeckoId: "",
      };

      // Parse the value from data
      const value = log.data;
      const from = "0x" + log.topics[1].slice(26);
      const to = "0x" + log.topics[2].slice(26);

      // Get block timestamp
      const block = (await rateLimitedEvmFetch("eth_getBlockByNumber", [
        log.blockNumber,
        false,
      ])) as { timestamp: string } | null;

      const timestamp = block
        ? parseInt(block.timestamp, 16).toString()
        : Math.floor(Date.now() / 1000).toString();

      transfers.push({
        hash: log.transactionHash,
        blockNumber: log.blockNumber,
        timeStamp: timestamp,
        from,
        to,
        value,
        contractAddress: tokenAddress,
        tokenName: tokenInfo.symbol,
        tokenSymbol: tokenInfo.symbol,
        tokenDecimal: tokenInfo.decimals.toString(),
        gas: "0",
        gasPrice: "0",
        gasUsed: "0",
      });
    }

    if (onProgress) {
      onProgress(transfers.length);
    }
  } catch (error) {
    console.error("Error fetching EVM token transfers:", error);
  }

  return transfers;
}

// Fetch all transactions (Cosmos + EVM)
export async function fetchAllTransactions(
  address: string,
  evmAddress?: string,
  onProgress?: (count: number, type: string) => void
): Promise<{
  cosmos: KavaTxResponse[];
  evmTransfers: EVMTokenTransfer[];
}> {
  // Fetch Cosmos transactions
  const cosmosTransactions = await fetchAllCosmosTransactions(
    address,
    onProgress
  );

  // Fetch EVM transactions if we have an EVM address
  let evmTransfers: EVMTokenTransfer[] = [];

  if (evmAddress && isValidEvmAddress(evmAddress)) {
    try {
      evmTransfers = await fetchEvmTokenTransfers(evmAddress, (count) => {
        if (onProgress) {
          onProgress(count, "EVM transfers");
        }
      });
    } catch (error) {
      console.error("Error fetching EVM transactions:", error);
    }
  }

  return {
    cosmos: cosmosTransactions,
    evmTransfers,
  };
}

// Convert micro units to standard units
export function microToStandard(amount: string, decimals: number = 6): number {
  const amountNum = parseInt(amount, 10);
  if (isNaN(amountNum)) return 0;
  return amountNum / Math.pow(10, decimals);
}

// Resolve IBC denom to token info
export function resolveIbcDenom(
  denom: string
): { symbol: string; decimals: number; coingeckoId: string } | null {
  // Check direct match first
  if (IBC_DENOMS[denom]) {
    return IBC_DENOMS[denom];
  }

  // Check if it's an IBC denom we don't know
  if (denom.startsWith("ibc/")) {
    // Return a generic IBC token representation
    return {
      symbol: `IBC/${denom.slice(4, 8)}...${denom.slice(-4)}`,
      decimals: 6,
      coingeckoId: "",
    };
  }

  return null;
}

// Parse coin amount with full token resolution
export function parseCoin(coin: CosmosCoin): {
  amount: number;
  symbol: string;
  denom: string;
  coingeckoId: string;
} {
  // Check native tokens first
  const nativeToken = KAVA_TOKENS[coin.denom];
  if (nativeToken) {
    return {
      amount: microToStandard(coin.amount, nativeToken.decimals),
      symbol: nativeToken.symbol,
      denom: coin.denom,
      coingeckoId: nativeToken.coingeckoId,
    };
  }

  // Check IBC denoms
  const ibcToken = resolveIbcDenom(coin.denom);
  if (ibcToken) {
    return {
      amount: microToStandard(coin.amount, ibcToken.decimals),
      symbol: ibcToken.symbol,
      denom: coin.denom,
      coingeckoId: ibcToken.coingeckoId,
    };
  }

  // Handle bkava variants (bkava-xxx for different validators)
  if (coin.denom.startsWith("bkava")) {
    return {
      amount: microToStandard(coin.amount, 6),
      symbol: "bKAVA",
      denom: coin.denom,
      coingeckoId: "kava",
    };
  }

  // Unknown denom
  return {
    amount: microToStandard(coin.amount, 6),
    symbol: coin.denom.toUpperCase(),
    denom: coin.denom,
    coingeckoId: "",
  };
}

// Parse coins array
export function parseCoins(
  coins: CosmosCoin[]
): Array<{ amount: number; symbol: string; denom: string; coingeckoId: string }> {
  return coins.map(parseCoin);
}

// Get fee from transaction
export function getTxFee(tx: KavaTxResponse): { amount: number; symbol: string } {
  const feeCoins = tx.tx?.auth_info?.fee?.amount || [];

  if (feeCoins.length === 0) {
    return { amount: 0, symbol: "KAVA" };
  }

  // Usually fee is in ukava
  const ukavaFee = feeCoins.find((c) => c.denom === "ukava");
  if (ukavaFee) {
    return {
      amount: microToStandard(ukavaFee.amount, 6),
      symbol: "KAVA",
    };
  }

  // Fallback to first fee
  const parsed = parseCoin(feeCoins[0]);
  return { amount: parsed.amount, symbol: parsed.symbol };
}

// Price cache to reduce API calls
const priceCache = new Map<string, number>();

// Fetch KAVA price from CoinGecko
export async function fetchKavaPrice(timestamp: Date): Promise<number | null> {
  const dateStr = timestamp.toISOString().split("T")[0];

  // Check cache first
  if (priceCache.has(dateStr)) {
    return priceCache.get(dateStr)!;
  }

  try {
    const [year, month, day] = dateStr.split("-");
    const formattedDate = `${day}-${month}-${year}`;

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/kava/history?date=${formattedDate}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const price = data.market_data?.current_price?.usd ?? null;

    if (price !== null) {
      priceCache.set(dateStr, price);
    }

    return price;
  } catch {
    return null;
  }
}

// Get unique dates from transactions
export function getUniqueDates(transactions: KavaTxResponse[]): string[] {
  const dates = new Set<string>();

  for (const tx of transactions) {
    const timestamp = new Date(tx.timestamp);
    const dateStr = timestamp.toISOString().split("T")[0];
    dates.add(dateStr);
  }

  return Array.from(dates);
}

// Extract events from transaction logs (improved version)
export function extractEvents(
  tx: KavaTxResponse,
  eventType: string
): Array<Record<string, string>> {
  const results: Array<Record<string, string>> = [];

  // Check tx_response events first (more reliable)
  if (tx.events) {
    for (const event of tx.events) {
      if (event.type === eventType) {
        const attrs: Record<string, string> = {};
        for (const attr of event.attributes) {
          // Handle base64 encoded attributes
          let key = attr.key;
          let value = attr.value;

          // Try to decode if it looks like base64
          try {
            if (key && /^[A-Za-z0-9+/=]+$/.test(key) && key.length > 4) {
              key = Buffer.from(key, "base64").toString("utf-8");
            }
            if (value && /^[A-Za-z0-9+/=]+$/.test(value) && value.length > 4) {
              value = Buffer.from(value, "base64").toString("utf-8");
            }
          } catch {
            // Keep original values if decode fails
          }

          attrs[key] = value;
        }
        results.push(attrs);
      }
    }
  }

  // Also check logs for more event details
  if (tx.logs) {
    for (const log of tx.logs) {
      for (const event of log.events || []) {
        if (event.type === eventType) {
          const attrs: Record<string, string> = {};
          for (const attr of event.attributes) {
            attrs[attr.key] = attr.value;
          }
          // Only add if not already captured
          if (!results.some((r) => JSON.stringify(r) === JSON.stringify(attrs))) {
            results.push(attrs);
          }
        }
      }
    }
  }

  return results;
}

// Extract transfer events for more accurate amount tracking
export function extractTransferEvents(
  tx: KavaTxResponse,
  address: string
): Array<{ recipient: string; sender: string; amount: string }> {
  const transfers: Array<{ recipient: string; sender: string; amount: string }> = [];

  const transferEvents = extractEvents(tx, "transfer");

  for (const event of transferEvents) {
    if (event.recipient === address || event.sender === address) {
      transfers.push({
        recipient: event.recipient || "",
        sender: event.sender || "",
        amount: event.amount || "",
      });
    }
  }

  return transfers;
}
