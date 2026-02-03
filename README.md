# Awaken Vibe Code Challenge

Multi-chain transaction exporter for [Awaken.tax](https://awaken.tax) CSV format.

## The Challenge

> **@big_duca (Duca - Awaken.tax Founder)**
>
> Vibe coders: it's time to see if you want to make money.
>
> **Prizes: up to $10,000**
>
> Every year, there are blockchain integrations we just cannot get to.
>
> So I want to try something.
>
> Vibe code a simple site that:
> - takes a wallet address
> - gets all of the transactions
> - allows you to view them in a nice table
> - download to csv button in Awaken's csv format
>
> Open source the code, deploy it, and send me a link.
>
> If what you build is good, and we use it.
>
> **I'll send you 1,000 USDC per integration.**
>
> And link to it for our 30k+ users.

### Chain Ideas from Awaken
- Bittensor ✅
- Polkadot ✅
- Osmosis ✅
- Ronin ✅
- Extended ✅ (Perps - requires user API key)
- Variational ⛔ (Blocked - no public API)
- Canton Network ✅ (Added - enterprise blockchain)
- Any other chain you think is worth something

### Planned Future Integrations

The following chains have been researched and are ready for implementation:

#### dYdX v4 (DYDX) - Perps DEX on Cosmos
- **Why**: Major perpetuals exchange, moved to own Cosmos chain
- **API**: Indexer API at [docs.dydx.exchange](https://docs.dydx.exchange/)
  - `/v4/addresses/{address}` - Account info
  - `/v4/fills` - Trade history
  - `/v4/transfers` - Deposits/withdrawals
  - `/v4/historicalFunding` - Funding payments
- **Difficulty**: Medium - use existing Perps CSV format (built for Extended)
- **Features**: Perps trades, positions, funding payments, P&L
- **Note**: No gas fees for orders (off-chain orderbook), fees only on execution
- **Docs**: [docs.dydx.exchange](https://docs.dydx.exchange/)

#### Already Supported by Awaken (skip these)
- TON (Toncoin) - Awaken already supports
- Sui (SUI) - Awaken already supports
- Celestia (TIA) - Awaken already supports

## Supported Chains

| Chain | Status | Features |
|-------|--------|----------|
| Bittensor (TAO) | ✅ Live | Transfers, Staking, Emission Rewards, USD Prices |
| Polkadot (DOT) | ✅ Live | Transfers, Staking, Rewards, Slashing, USD Prices |
| Kusama (KSM) | ✅ Live | Transfers, Staking, Rewards, Slashing, Crowdloans, Auctions, USD Prices |
| Osmosis (OSMO) | ✅ Live | Transfers, Swaps, LP Positions, Staking, IBC, USD Prices |
| Injective (INJ) | ✅ Live | Transfers, Staking, Rewards, IBC, Trading, USD Prices |
| Ronin (RON) | ✅ Live | Transfers, Swaps, NFT Trades, Staking, Gaming (AXS/SLP), USD Prices |
| Variational | ⛔ Blocked | No public API - see note below |
| Extended | ✅ Live | Perps Trades, Positions, Funding, P&L (requires user API key) |
| Canton Network (CC) | ✅ Live | Transfers, Rewards, Fees, Locked CC |

### Variational Limitations

Variational (Arbitrum-based perps protocol) cannot be integrated due to its **privacy-first architecture**:

- **No public API** - Trading API is not available; API keys require direct contact with Variational team
- **Private trades** - Uses RFQ model where individual trades are intentionally hidden from on-chain visibility
- **No CSV export** - Feature is planned but undated on their roadmap
- **Settlement pools only** - Only deposits/withdrawals to escrow contracts are visible on Arbitrum

Users can view their trades at [omni.variational.io/portfolio](https://omni.variational.io/portfolio?tab=trades) but cannot export them.

For more info: [Variational Docs](https://docs.variational.io/) | [Why Omni bets on privacy](https://blockworks.co/news/variational-omni-privacy)

### Extended Integration

Extended (Starknet-based perps DEX) is **fully integrated** and uses the **Awaken Perps CSV format**.

**User Requirements:**
- **API Key only** - Created in Extended's UI at [extended.exchange](https://extended.exchange)
- **No Stark private key needed** - Only required for placing orders, not reading history

**Why API Key?**
Extended uses a hybrid CLOB model where orders are matched off-chain. While settlements occur on Starknet, individual trade details (P&L, entry/exit prices) require API access.

**CSV Output:**
Uses Awaken's Perps/Futures CSV format with columns: Date, Asset, Amount, Fee, P&L, Payment Token, Notes, Transaction Hash, Tag

For more info: [Extended Docs](https://docs.extended.exchange) | [Extended API](https://api.docs.extended.exchange/)

## Features

- **Multi-chain support** - Modular architecture for adding new chains
- **Awaken.tax CSV format** - Direct export compatible with Awaken's import
- **Historical USD prices** - Fiat values at time of transaction
- **Staking & Rewards** - Includes delegation events and emission rewards
- **Dark/Light mode** - Clean, modern UI

---

## Awaken CSV Format

The exported CSV follows Awaken's official format. For the full guide, see [How to Format Your CSV for Awaken Tax](https://help.awaken.tax/en/articles/10422149-how-to-format-your-csv-for-awaken-tax).

### CSV Requirements

- **Header Row**: Must match exactly with Awaken's format
- **Date Format**: `MM/DD/YYYY HH:MM:SS` in UTC (e.g., `09/30/2019 07:19:01`)
- **No Negatives**: All quantities must be positive
- **Decimal Precision**: Up to 8 decimal places

### Column Definitions

| Column | Description | Example |
|--------|-------------|---------|
| Date | MM/DD/YYYY HH:MM:SS in UTC | 09/30/2019 07:19:01 |
| Received Quantity | Amount received (empty for sends) | 10 |
| Received Currency | Token symbol | SOL |
| Received Fiat Amount | USD value at time (optional) | 1000.00 |
| Sent Quantity | Amount sent (empty for receives) | 10 |
| Sent Currency | Token symbol | USDC |
| Sent Fiat Amount | USD value at time (optional) | 10.00 |
| Fee Amount | Transaction fee amount | 0.001 |
| Fee Currency | Fee token symbol | SOL |
| Transaction Hash | Blockchain tx hash (optional) | 0x... |
| Notes | Additional info (optional) | Staking reward |
| Tag | Transaction label (optional) | staking |

### Transaction Type Guidelines

**Send/Withdrawal Transactions:**
- Leave "Received Quantity" and currency empty
- Sent quantity excludes transfer fees
- Example: If you transferred 1 ETH but paid 0.1 ETH fee, sent quantity = 0.9 ETH, fee = 0.1 ETH

**Receive/Deposit Transactions:**
- Keep sent quantity and currency empty
- Received quantity excludes fees

**Trade Transactions:**
- Include values for both received and sent quantity/currency

### Example Transactions

| Action | Date | Received Qty | Received Currency | Sent Qty | Sent Currency | Fee | Fee Currency |
|--------|------|--------------|-------------------|----------|---------------|-----|--------------|
| Sent 10 USDC | 01/15/2024 12:00:00 | | | 10 | USDC | 0.001 | SOL |
| Received 10 SOL | 01/15/2024 12:00:00 | 10 | SOL | | | | |
| Swapped 10 USDC for 1 SOL | 01/15/2024 12:00:00 | 1 | SOL | 10 | USDC | 0.001 | SOL |

### Available Tags

See [Awaken Labels Documentation](https://help.awaken.tax/en/articles/8187344-labels) for the full list of available tags.

### Multi-Asset Template

For complex transactions (e.g., adding liquidity with multiple assets), Awaken provides a multi-asset template. Download it from [Awaken's CSV Format Guide](https://help.awaken.tax/en/articles/10422149-how-to-format-your-csv-for-awaken-tax).

---

## Perpetuals/Futures CSV Format

For perpetuals and futures trading, Awaken uses a **different CSV format**. See the full guide at [Formatting Perpetuals/Futures CSVs](https://help.awaken.tax/en/articles/10453931-formatting-perpetuals-futures-csvs).

### Perps CSV Columns

| Column | Description | Example |
|--------|-------------|---------|
| Date | MM/DD/YYYY HH:MM:SS in UTC | 04/01/2024 12:00:00 |
| Asset | Underlying perpetuals asset | BTC, ETH, FARTCOIN |
| Amount | Amount of underlying asset | 2 |
| Fee | Fee in payment token | 0.5 |
| P&L | Net profit/loss (can be negative, positive, or zero) | +20, -15, 0 |
| Payment Token | Token P&L is settled in | USDC, USDT |
| Notes | Optional notes | - |
| Transaction Hash | Hash for the trade | 0x... |
| Tag | Position tag | `open_position`, `close_position`, `funding_payment` |

### Perps Tags

| Tag | Use Case |
|-----|----------|
| `open_position` | Opening a long or short position |
| `close_position` | Closing a position (include P&L) |
| `funding_payment` | Receiving/paying funding payments |

### Perps Example

| Date | Asset | Amount | Fee | P&L | Payment Token | Tag |
|------|-------|--------|-----|-----|---------------|-----|
| 04/01/2024 12:00:00 | BTC | 2 | 0.1 | 0 | USDC | open_position |
| 04/02/2024 15:30:00 | BTC | 1 | 0.1 | +20 | USDC | close_position |
| 04/04/2024 00:00:00 | USDC | 10 | 0 | +10 | USDC | funding_payment |

**Key Differences from Standard CSV:**
- Uses `P&L` column instead of `Received/Sent` columns
- P&L can be negative (losses)
- `Payment Token` specifies the settlement currency
- Different tag set (`open_position`, `close_position`, `funding_payment`)

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/andresdefi/Awaken-vibe-code-challenge.git
cd Awaken-vibe-code-challenge
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
# Bittensor (Taostats API)
# Get your free API key at https://dash.taostats.io
TAOSTATS_API_KEY=your_api_key_here

# Polkadot (Subscan API)
# Get your free API key at https://pro.subscan.io
SUBSCAN_API_KEY=your_api_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

---

## Chain Integrations

### Bittensor (TAO)

**Transaction Types Supported:**

| Bittensor Event | Awaken.tax Tag |
|-----------------|----------------|
| TAO Sent | `payment` |
| TAO Received | `receive` |
| Stake (Delegation) | `staking_deposit` |
| Unstake | `unstaking_withdraw` |
| Emission Rewards | `claim_rewards` |

**API Used:**
- **Taostats API** - [api.taostats.io](https://api.taostats.io)
  - `/transfer/v1` - Transfer history
  - `/dtao/delegation/v1` - Staking/delegation events
  - `/dtao/stake_balance/history/v1` - Emission rewards calculation
  - `/price/history/v1` - Historical USD prices

**Rate Limiting:** 5 requests per minute (burst approach with 62-second cooldown)

---

### Polkadot (DOT)

**Transaction Types Supported:**

| Polkadot Event | Awaken.tax Tag |
|----------------|----------------|
| DOT Sent | `payment` |
| DOT Received | `receive` |
| Bond (Stake) | `staking_deposit` |
| Unbond | `unstaking_withdraw` |
| Staking Rewards | `claim_rewards` |
| Slashing | `lost` |

**API Used:**
- **Subscan API** - [polkadot.subscan.io](https://polkadot.subscan.io)
  - `/api/v2/scan/transfers` - Transfer history
  - `/api/scan/account/reward_slash` - Staking rewards and slashes
  - `/api/v2/scan/extrinsics` - Staking extrinsics (bond, unbond, nominate)
  - `/api/scan/price/history` - Historical USD prices

**Rate Limiting:** 5 requests per second (sliding window)

---

### Kusama (KSM)

Kusama is Polkadot's canary network - an experimental platform where new features are tested before deployment to Polkadot. It shares the same Substrate architecture and uses the same Subscan API.

**Key Differences from Polkadot:**
- **Unbonding Period:** 7 days (vs 28 days on Polkadot)
- **Decimals:** 12 (1 KSM = 10^12 Planck vs DOT's 10^10)
- **Address Format:** Starts with C, D, E, F, G, H, or J (SS58 prefix 2)
- **Governance:** Faster cycles (7 days vote + 8 days implementation)

**Transaction Types Supported:**

| Kusama Event | Awaken.tax Tag |
|--------------|----------------|
| KSM Sent | `payment` |
| KSM Received | `receive` |
| Bond (Stake) | `staking_deposit` |
| Unbond | `unstaking_withdraw` |
| Staking Rewards | `claim_rewards` |
| Slashing | `lost` |
| Crowdloan Contribution | `staking_deposit` |
| Crowdloan Refund | `receive` |
| Auction Bid | `staking_deposit` |

**API Used:**
- **Subscan API** - [kusama.subscan.io](https://kusama.subscan.io)
  - `/api/v2/scan/transfers` - Transfer history
  - `/api/scan/account/reward_slash` - Staking rewards and slashes
  - `/api/v2/scan/extrinsics` - Staking extrinsics (bond, unbond, nominate)
  - `/api/scan/parachain/contributes` - Crowdloan contributions
  - `/api/scan/parachain/bids` - Auction bids
  - `/api/scan/price/history` - Historical USD prices

**Crowdloan & Auction Tracking:**

Kusama supports parachain slot auctions where projects compete for limited slots. Users can participate by:
- **Crowdloans:** Contributing KSM to support a parachain's bid (funds locked for lease duration, ~48 weeks)
- **Auction Bids:** Directly bidding on parachain slots

Both are tracked as `staking_deposit` since funds are locked. When a crowdloan is refunded (project didn't win or lease ended), it's tracked as `receive`.

**Rate Limiting:** 5 requests per second (sliding window, shared with Polkadot API key)

---

### Osmosis (OSMO)

**Transaction Types Supported:**

| Osmosis Event | Awaken.tax Tag |
|---------------|----------------|
| OSMO Sent | `payment` |
| OSMO Received | `receive` |
| IBC Transfer | `wallet_transfer` |
| Delegate | `staking_deposit` |
| Undelegate | `unstaking_withdraw` |
| Staking Rewards | `claim_rewards` |
| Swap | `payment` |
| Add Liquidity | `payment` |
| Remove Liquidity | `receive` |
| Lock LP Tokens | `staking_deposit` |
| Unlock LP Tokens | `unstaking_withdraw` |

**API Used:**
- **Osmosis RPC** - [rpc.osmosis.zone](https://rpc.osmosis.zone)
  - `/tx_search` - Transaction history by address
- **Osmosis LCD** - Multiple endpoints with fallback
  - `/cosmos/tx/v1beta1/txs/{hash}` - Decoded transaction details
  - `/ibc/apps/transfer/v1/denom_traces/{hash}` - IBC denom resolution
- **CoinGecko API** - Historical USD prices
- **Chain Registry** - Asset metadata

**Rate Limiting:** 2 requests per second

---

### Injective (INJ)

Injective is a Cosmos SDK-based L1 blockchain optimized for DeFi applications, featuring an on-chain order book for spot and perpetual futures trading.

**Key Details:**
- **Address Format:** Bech32 with `inj` prefix (e.g., `inj1hkhdaj2a2clmq5jq6mspsggqs7x6uq6cvlpwmq`)
- **Decimals:** 18 (same as Ethereum)
- **Unbonding Period:** 21 days
- **Block Time:** ~1 second

**Transaction Types Supported:**

| Injective Event | Awaken.tax Tag |
|-----------------|----------------|
| INJ Sent | `payment` |
| INJ Received | `receive` |
| IBC Transfer | `wallet_transfer` |
| Delegate (Stake) | `staking_deposit` |
| Undelegate | `unstaking_withdraw` |
| Redelegate | `staking_deposit` |
| Staking Rewards | `claim_rewards` |
| Spot Trade | `trade` |

**API Used:**
- **Injective RPC** - [sentry.tm.injective.network](https://sentry.tm.injective.network)
  - `/tx_search` - Transaction history by address
- **Injective LCD** - [sentry.lcd.injective.network](https://sentry.lcd.injective.network)
  - `/cosmos/tx/v1beta1/txs/{hash}` - Decoded transaction details
  - `/cosmos/staking/v1beta1/delegations/{address}` - Delegation data
  - `/cosmos/distribution/v1beta1/delegators/{address}/rewards` - Staking rewards
  - `/ibc/apps/transfer/v1/denom_traces/{hash}` - IBC denom resolution
- **CoinGecko API** - Historical USD prices (CoinGecko ID: `injective-protocol`)

**Rate Limiting:** 2 requests per second (conservative for public endpoints)

**Note:** Injective uses 18 decimals (1 INJ = 10^18 wei), which is different from most Cosmos chains that use 6 decimals. The integration handles this automatically.

---

### Ronin (RON)

**Transaction Types Supported:**

| Ronin Event | Awaken.tax Tag |
|-------------|----------------|
| RON Sent | `payment` |
| RON Received | `receive` |
| Token Sent (AXS, SLP, etc.) | `payment` |
| Token Received | `receive` |
| Token Swap | `trade` |
| NFT Purchase | `payment` |
| NFT Sale | `receive` |
| NFT Sent | `gift_sent` |
| NFT Received | `gift_received` |
| Delegate (Stake) | `staking_deposit` |
| Undelegate | `unstaking_withdraw` |
| Claim Rewards | `claim_rewards` |
| Airdrop | `airdrop` |

**API Used:**
- **Moralis API** - [moralis.com](https://moralis.com)
  - `/wallets/{address}/history` - Decoded wallet history with categories
  - `/{address}/erc20/transfers` - ERC20 token transfers
  - `/{address}/nft/transfers` - NFT transfers
- **CoinGecko API** - Historical USD prices for RON, AXS, SLP, etc.

**Rate Limiting:** 25 requests per second (conservative limit)

**Key Contracts:**
- Staking Contract: `0x9C245671791834daf3885533D24dce516B763B28`
- Katana DEX Router V2: `0x7d0556d55ca1a92708681e2e231733ebd922597d`

---

### Extended (Perps)

**Transaction Types Supported:**

| Extended Event | Awaken.tax Tag |
|----------------|----------------|
| Open Trade | `open_position` |
| Close Trade (with P&L) | `close_position` |
| Funding Payment | `funding_payment` |

**CSV Format:** Uses Awaken's **Perps/Futures CSV format** (not standard format)

**API Used:**
- **Extended API** - [api.starknet.extended.exchange](https://api.starknet.extended.exchange)
  - `/v1/trades` - Trade history with pagination
  - `/v1/funding-payments` - Funding payment history
  - `/v1/asset-operations` - Deposits/withdrawals
  - `/v1/account` - Account validation

**Authentication:** User-provided API key via `X-Api-Key` header

**Rate Limiting:** 10 requests per second (conservative estimate)

**Starknet Contract:** `0x062da0780fae50d68cecaa5a051606dc21217ba290969b302db4dd99d2e9b470`

---

### Canton Network (CC)

**Transaction Types Supported:**

| Canton Event | Awaken.tax Tag |
|--------------|----------------|
| CC Sent | `payment` |
| CC Received | `receive` |
| App Rewards | `claim_rewards` |
| Validator Rewards | `claim_rewards` |
| SV Rewards | `claim_rewards` |
| Locked CC | `staking_deposit` |

**API Used:**
- **Canton Nodes API** - [api.cantonnodes.com](https://api.cantonnodes.com)
  - `/v2/updates` - Transaction history with pagination
  - `/v0/wallet-balance` - Party balance at specific round
  - `/v0/round-of-latest-data` - Latest round number

**Authentication:** None required for free tier (rate limited)

**Rate Limiting:** ~5 requests per second (free tier)

**Party ID Format:** `hint::hash` (e.g., `MyWallet::1220abc123...`)

**Note:** Canton is a privacy-first enterprise blockchain used by financial institutions. Transaction data is publicly visible for Canton Coin (CC) transfers, but private transactions remain private.

For more info: [Canton Network](https://canton.network) | [Canton Nodes](https://cantonnodes.com)

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page with chain selector
│   ├── bittensor/
│   │   └── page.tsx                # Bittensor transaction UI
│   ├── polkadot/
│   │   └── page.tsx                # Polkadot transaction UI
│   ├── kusama/
│   │   └── page.tsx                # Kusama transaction UI
│   ├── osmosis/
│   │   └── page.tsx                # Osmosis transaction UI
│   ├── injective/
│   │   └── page.tsx                # Injective transaction UI
│   ├── ronin/
│   │   └── page.tsx                # Ronin transaction UI
│   ├── extended/
│   │   └── page.tsx                # Extended perps UI
│   ├── canton/
│   │   └── page.tsx                # Canton Network UI
│   └── api/
│       ├── bittensor/transactions/ # Bittensor API endpoint
│       ├── polkadot/transactions/  # Polkadot API endpoint
│       ├── kusama/transactions/    # Kusama API endpoint
│       ├── osmosis/transactions/   # Osmosis API endpoint
│       ├── injective/transactions/ # Injective API endpoint
│       ├── ronin/transactions/     # Ronin API endpoint
│       ├── extended/transactions/  # Extended API endpoint
│       └── canton/transactions/    # Canton API endpoint
├── components/
│   ├── wallet-input.tsx            # Reusable wallet address input
│   ├── transaction-table.tsx       # Transaction display table
│   ├── download-button.tsx         # CSV download button
│   ├── progress-indicator.tsx      # Loading progress
│   ├── skeleton.tsx                # Loading skeletons
│   └── theme-toggle.tsx            # Dark/light mode toggle
└── lib/
    ├── types.ts                    # Shared types
    ├── utils.ts                    # Shared utilities
    ├── csv.ts                      # Awaken CSV generation
    └── chains/
        ├── bittensor/
        │   ├── taostats.ts         # Taostats API client
        │   ├── transactions.ts     # Transaction normalizer
        │   ├── types.ts            # Bittensor-specific types
        │   └── utils.ts            # Bittensor utilities
        ├── polkadot/
        │   ├── subscan.ts          # Subscan API client
        │   ├── transactions.ts     # Transaction normalizer
        │   ├── types.ts            # Polkadot-specific types
        │   └── utils.ts            # Polkadot utilities
        ├── kusama/
        │   ├── subscan.ts          # Subscan API client (Kusama endpoint)
        │   ├── transactions.ts     # Transaction normalizer + crowdloans
        │   ├── types.ts            # Kusama-specific types
        │   └── utils.ts            # Kusama utilities (12 decimals)
        ├── osmosis/
        │   ├── api.ts              # RPC/LCD API client
        │   ├── transactions.ts     # Transaction normalizer
        │   ├── types.ts            # Osmosis-specific types
        │   └── utils.ts            # Osmosis utilities
        ├── injective/
        │   ├── api.ts              # Cosmos LCD/RPC API client
        │   ├── transactions.ts     # Transaction normalizer
        │   ├── types.ts            # Injective-specific types
        │   └── utils.ts            # Injective utilities (18 decimals)
        ├── ronin/
        │   ├── moralis.ts          # Moralis API client
        │   ├── transactions.ts     # Transaction normalizer
        │   ├── types.ts            # Ronin-specific types
        │   └── utils.ts            # Ronin utilities
        ├── extended/
        │   ├── api.ts              # Extended API client
        │   ├── transactions.ts     # Perps transaction normalizer
        │   └── types.ts            # Extended-specific types
        └── canton/
            ├── api.ts              # Canton Nodes API client
            ├── transactions.ts     # Transaction normalizer
            └── types.ts            # Canton-specific types
```

---

## Adding a New Chain

1. Create a new folder in `src/lib/chains/[chain-name]/`
2. Implement:
   - `types.ts` - Chain-specific types
   - `utils.ts` - Address validation, unit conversion
   - `api.ts` or `[provider].ts` - API client with rate limiting
   - `transactions.ts` - Normalize to `NormalizedTransaction` type
3. Add an API route in `src/app/api/[chain-name]/transactions/route.ts`
4. Create the UI page in `src/app/[chain-name]/page.tsx`
5. Add the chain config to `src/app/page.tsx` CHAINS array

---

## Resources

- [Awaken CSV Format Guide](https://help.awaken.tax/en/articles/10422149-how-to-format-your-csv-for-awaken-tax)
- [Awaken Perps/Futures CSV Format](https://help.awaken.tax/en/articles/10453931-formatting-perpetuals-futures-csvs)
- [Awaken Labels Documentation](https://help.awaken.tax/en/articles/8187344-labels)

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Deployment**: Vercel

## License

MIT License - Open source for the community

## Acknowledgments

- [Taostats](https://taostats.io) for the Bittensor API
- [Subscan](https://subscan.io) for the Polkadot API
- [Osmosis](https://osmosis.zone) for the public RPC endpoints
- [CoinGecko](https://coingecko.com) for price data
- [Awaken.tax](https://awaken.tax) for the vibe coding challenge
