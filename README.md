# Awaken Vibe Code Challenge

Multi-chain transaction exporter for [Awaken.tax](https://awaken.tax) CSV format.

**Live Demo:** [awaken-vibe-code-challenge.vercel.app](https://awaken-vibe-code-challenge.vercel.app)

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

## Supported Chains (12 Integrations)

| Chain | Type | Features | API Key Required |
|-------|------|----------|------------------|
| Bittensor (TAO) | L1 | Transfers, Staking, Emission Rewards, USD Prices | No |
| Polkadot (DOT) | L1 | Transfers, Staking, Rewards, Slashing, USD Prices | No |
| Kusama (KSM) | L1 | Transfers, Staking, Crowdloans, Auctions, USD Prices | No |
| Osmosis (OSMO) | Cosmos | Transfers, Swaps, LP, Staking, IBC, USD Prices | No |
| Injective (INJ) | Cosmos | Transfers, Staking, IBC, Trading, USD Prices | No |
| Ronin (RON) | EVM | Transfers, Swaps, NFTs, Staking, Gaming, USD Prices | No |
| Hedera (HBAR) | L1 | Transfers, Staking Rewards, HTS Tokens, NFTs, USD Prices | No |
| XRP Ledger (XRP) | L1 | Transfers, DEX Trades, NFTs, AMM, Escrow, USD Prices | No |
| Kava (KAVA) | Cosmos+EVM | Transfers, Staking, CDP, Lending, Swaps, Rewards, USD Prices | No |
| Extended | Perps | Trades, Positions, Funding, P&L | Yes (API Key) |
| dYdX v4 (DYDX) | Perps | Trades, Positions, Funding, P&L | No |
| Canton Network (CC) | Enterprise | Transfers, Rewards, Fees, Locked CC | No |

### Not Integrated

| Chain | Reason |
|-------|--------|
| Variational | No public API (privacy-first architecture) |

## Features

- **12 Chain Integrations** - Diverse ecosystems including L1s, Cosmos, EVM, and Perps DEXs
- **Unified UI** - Single-page flow with dropdown chain selector
- **Awaken Branding** - Matches Awaken.tax color scheme and styling
- **Two CSV Formats** - Standard format + Perps/Futures format
- **Historical USD Prices** - Fiat values at time of transaction
- **Rate Limit Warnings** - Clear warnings for slow APIs (Bittensor)
- **Dark/Light Mode** - User preference toggle
- **No Wallet Connection** - Just enter address and export

---

## Quick Start

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
TAOSTATS_API_KEY=your_api_key_here

# Polkadot/Kusama (Subscan API)
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

## CSV Formats

### Standard CSV Format

For regular blockchain transactions. See [Awaken CSV Format Guide](https://help.awaken.tax/en/articles/10422149-how-to-format-your-csv-for-awaken-tax).

| Column | Description |
|--------|-------------|
| Date | MM/DD/YYYY HH:MM:SS in UTC |
| Received Quantity | Amount received |
| Received Currency | Token symbol |
| Received Fiat Amount | USD value (optional) |
| Sent Quantity | Amount sent |
| Sent Currency | Token symbol |
| Sent Fiat Amount | USD value (optional) |
| Fee Amount | Transaction fee |
| Fee Currency | Fee token symbol |
| Transaction Hash | Blockchain tx hash |
| Notes | Additional info |
| Tag | Transaction label |

### Perpetuals/Futures CSV Format

For perps trading (Extended, dYdX). See [Perps CSV Format Guide](https://help.awaken.tax/en/articles/10453931-formatting-perpetuals-futures-csvs).

| Column | Description |
|--------|-------------|
| Date | MM/DD/YYYY HH:MM:SS in UTC |
| Asset | Underlying asset (BTC, ETH, etc.) |
| Amount | Position size |
| Fee | Fee in payment token |
| P&L | Profit/loss (can be negative) |
| Payment Token | Settlement currency (USDC) |
| Notes | Optional notes |
| Transaction Hash | Trade hash |
| Tag | `open_position`, `close_position`, `funding_payment` |

---

## Chain Integrations

### Bittensor (TAO)

| Event | Tag |
|-------|-----|
| TAO Sent | `payment` |
| TAO Received | `receive` |
| Stake (Delegation) | `staking_deposit` |
| Unstake | `unstaking_withdraw` |
| Emission Rewards | `claim_rewards` |

**API:** Taostats API
**Rate Limit:** 5 requests/minute (warning displayed in UI)

---

### Polkadot (DOT)

| Event | Tag |
|-------|-----|
| DOT Sent | `payment` |
| DOT Received | `receive` |
| Bond (Stake) | `staking_deposit` |
| Unbond | `unstaking_withdraw` |
| Staking Rewards | `claim_rewards` |
| Slashing | `lost` |

**API:** Subscan API
**Rate Limit:** 5 requests/second

---

### Kusama (KSM)

| Event | Tag |
|-------|-----|
| KSM Sent | `payment` |
| KSM Received | `receive` |
| Bond (Stake) | `staking_deposit` |
| Unbond | `unstaking_withdraw` |
| Staking Rewards | `claim_rewards` |
| Slashing | `lost` |
| Crowdloan Contribution | `staking_deposit` |
| Crowdloan Refund | `receive` |

**API:** Subscan API
**Rate Limit:** 5 requests/second

---

### Osmosis (OSMO)

| Event | Tag |
|-------|-----|
| OSMO Sent | `payment` |
| OSMO Received | `receive` |
| IBC Transfer | `wallet_transfer` |
| Delegate | `staking_deposit` |
| Undelegate | `unstaking_withdraw` |
| Staking Rewards | `claim_rewards` |
| Swap | `payment` |
| Add Liquidity | `payment` |
| Remove Liquidity | `receive` |

**API:** Osmosis RPC/LCD + CoinGecko
**Rate Limit:** 2 requests/second

---

### Injective (INJ)

| Event | Tag |
|-------|-----|
| INJ Sent | `payment` |
| INJ Received | `receive` |
| IBC Transfer | `wallet_transfer` |
| Delegate | `staking_deposit` |
| Undelegate | `unstaking_withdraw` |
| Staking Rewards | `claim_rewards` |
| Spot Trade | `trade` |

**API:** Injective RPC/LCD + CoinGecko
**Rate Limit:** 2 requests/second

---

### Ronin (RON)

| Event | Tag |
|-------|-----|
| RON Sent | `payment` |
| RON Received | `receive` |
| Token Swap | `trade` |
| NFT Purchase | `payment` |
| NFT Sale | `receive` |
| Delegate | `staking_deposit` |
| Claim Rewards | `claim_rewards` |

**API:** Moralis API + CoinGecko
**Rate Limit:** 25 requests/second

---

### Hedera (HBAR)

| Event | Tag |
|-------|-----|
| HBAR Sent | `payment` |
| HBAR Received | `receive` |
| Staking Rewards | `claim_rewards` |
| HTS Token Sent | `payment` |
| HTS Token Received | `receive` |
| NFT Sent | `gift_sent` |
| NFT Received | `receive` |

**API:** Hedera Mirror Node (public, no API key required)
**Rate Limit:** 35 requests/second (actual limit is 50/sec)

---

### Extended (Perps)

| Event | Tag |
|-------|-----|
| Open Trade | `open_position` |
| Close Trade | `close_position` |
| Funding Payment | `funding_payment` |

**API:** Extended API (requires user API key)
**Rate Limit:** 10 requests/second
**CSV Format:** Perps/Futures format

---

### dYdX v4 (Perps)

| Event | Tag |
|-------|-----|
| Open Trade | `open_position` |
| Close Trade | `close_position` |
| Funding Payment | `funding_payment` |

**API:** dYdX Indexer (public, no API key required)
**Rate Limit:** 10 requests/second
**CSV Format:** Perps/Futures format

---

### Canton Network (CC)

| Event | Tag |
|-------|-----|
| CC Sent | `payment` |
| CC Received | `receive` |
| App Rewards | `claim_rewards` |
| Validator Rewards | `claim_rewards` |
| Locked CC | `staking_deposit` |

**API:** Canton Nodes API
**Rate Limit:** 5 requests/second

---

### XRP Ledger (XRP)

| Event | Tag |
|-------|-----|
| XRP Sent | `payment` |
| XRP Received | `receive` |
| Token Sent | `payment` |
| Token Received | `receive` |
| DEX Trade (OfferCreate) | `trade` |
| NFT Mint | `receive` |
| NFT Burn | `lost` |
| NFT Trade | `trade` |
| AMM Deposit | `payment` |
| AMM Withdraw | `receive` |
| Escrow Create | `staking_deposit` |
| Escrow Finish | `unstaking_withdraw` |
| Payment Channel Create | `staking_deposit` |
| Payment Channel Claim | `receive` |
| Check Cash | `receive` |

**API:** XRPL Public Servers (s2.ripple.com - Full History)
**Rate Limit:** Dynamic (conservative 10 req/sec used)

---

### Kava (KAVA)

| Event | Tag |
|-------|-----|
| KAVA Sent | `payment` |
| KAVA Received | `receive` |
| Delegate (Stake) | `staking_deposit` |
| Undelegate | `unstaking_withdraw` |
| Claim Staking Rewards | `claim_rewards` |
| Create CDP | `staking_deposit` |
| Deposit to CDP | `staking_deposit` |
| Withdraw from CDP | `unstaking_withdraw` |
| Draw USDX Debt | `receive` |
| Repay USDX Debt | `payment` |
| Hard Deposit (Lend) | `staking_deposit` |
| Hard Withdraw | `unstaking_withdraw` |
| Hard Borrow | `receive` |
| Hard Repay | `payment` |
| Swap Tokens | `trade` |
| Add Liquidity | `payment` |
| Remove Liquidity | `receive` |
| Claim USDX Rewards | `claim_rewards` |
| Claim Hard Rewards | `claim_rewards` |
| Claim Swap Rewards | `claim_rewards` |
| Mint bKAVA | `staking_deposit` |
| Burn bKAVA | `unstaking_withdraw` |
| IBC Transfer | `wallet_transfer` |

**API:** Kava Archive API (api.data.kava.io)
**Rate Limit:** 100 requests per 5 minutes

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main page with unified chain selector
│   └── api/
│       ├── bittensor/transactions/
│       ├── polkadot/transactions/
│       ├── kusama/transactions/
│       ├── osmosis/transactions/
│       ├── injective/transactions/
│       ├── ronin/transactions/
│       ├── hedera/transactions/
│       ├── extended/transactions/
│       ├── dydx/transactions/
│       ├── canton/transactions/
│       ├── xrpl/transactions/
│       └── kava/transactions/
├── components/
│   ├── chain-logo.tsx              # Chain logos with fallbacks
│   ├── theme-toggle.tsx            # Dark/light mode
│   ├── progress-indicator.tsx      # Loading states
│   └── ...
└── lib/
    ├── csv.ts                      # CSV generation (standard + perps)
    └── chains/
        ├── bittensor/
        ├── polkadot/
        ├── kusama/
        ├── osmosis/
        ├── injective/
        ├── ronin/
        ├── hedera/
        ├── extended/
        ├── dydx/
        ├── canton/
        ├── xrpl/
        └── kava/
```

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel

## Resources

- [Awaken CSV Format Guide](https://help.awaken.tax/en/articles/10422149-how-to-format-your-csv-for-awaken-tax)
- [Awaken Perps CSV Format](https://help.awaken.tax/en/articles/10453931-formatting-perpetuals-futures-csvs)
- [Awaken Labels](https://help.awaken.tax/en/articles/8187344-labels)

## License

MIT License - Open source for the community

## Acknowledgments

- [Awaken.tax](https://awaken.tax) for the vibe coding challenge
- [Taostats](https://taostats.io) for the Bittensor API
- [Subscan](https://subscan.io) for the Polkadot/Kusama API
- [CoinGecko](https://coingecko.com) for price data
- [dYdX](https://dydx.exchange) for the public indexer API
- [Hedera](https://hedera.com) for the Mirror Node API
- [XRP Ledger](https://xrpl.org) for the public API servers
- [Kava](https://www.kava.io) for the archive API servers
