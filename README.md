# Bittensor Tax CSV Exporter

Export your Bittensor (TAO) wallet transactions to [Awaken.tax](https://awaken.tax) CSV format for easy crypto tax reporting.

## Features

- **Wallet Lookup**: Enter any Bittensor wallet address (SS58 format starting with "5")
- **Complete Transaction History**: Fetches all transfers, staking/unstaking events, and calculates emission rewards
- **Awaken.tax Compatible**: Exports in the exact CSV format required by Awaken.tax
- **Price Data**: Includes USD fiat values at time of transaction (when available)
- **Pagination Handling**: Automatically fetches all transactions regardless of history size
- **Dark Mode UI**: Clean, modern interface

## Transaction Types Supported

| Bittensor Event | Awaken.tax Tag |
|-----------------|----------------|
| TAO Sent | `payment` |
| TAO Received | `receive` |
| Stake (Delegation) | `staking_deposit` |
| Unstake | `unstaking_withdraw` |
| Emission Rewards | `claim_rewards` |

## Getting Started

### Prerequisites

- Node.js 22.3.0 or higher (required for the Taostats SDK)
- A Taostats API key (free tier available)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/bittensor-tax-csv.git
   cd bittensor-tax-csv
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Get a Taostats API key:
   - Visit [dash.taostats.io](https://dash.taostats.io)
   - Sign in and create an API key

4. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` and add your API key:
   ```
   TAOSTATS_API_KEY=your_api_key_here
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## CSV Format

The exported CSV follows Awaken.tax's format specification:

| Column | Description |
|--------|-------------|
| Date | MM/DD/YYYY HH:MM:SS (UTC) |
| Received Quantity | Amount of TAO received |
| Received Currency | "TAO" |
| Received Fiat Amount | USD value at time of transaction |
| Sent Quantity | Amount of TAO sent |
| Sent Currency | "TAO" |
| Sent Fiat Amount | USD value at time of transaction |
| Fee Amount | Transaction fee in TAO |
| Fee Currency | "TAO" |
| Transaction Hash | Blockchain transaction hash |
| Notes | Description of the transaction |
| Tag | Awaken.tax transaction label |

## API Endpoints

### GET `/api/transactions`

Fetch transactions for a wallet address.

**Query Parameters:**
- `address` (required): Bittensor wallet address (SS58 format)
- `format`: Response format - `json` (default) or `csv`
- `start`: Start date filter (ISO 8601)
- `end`: End date filter (ISO 8601)

**Example:**
```bash
# JSON response
curl "http://localhost:3000/api/transactions?address=5DJgMDvzC27QTBfmgGQaNWBQd8CKP9z5A12yjbG6TZ5bxNE1"

# CSV download
curl "http://localhost:3000/api/transactions?address=5DJgMDvzC27QTBfmgGQaNWBQd8CKP9z5A12yjbG6TZ5bxNE1&format=csv"
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API Client**: Taostats SDK
- **Deployment**: Vercel-ready

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/bittensor-tax-csv&env=TAOSTATS_API_KEY)

Remember to set `TAOSTATS_API_KEY` in your Vercel environment variables.

## License

MIT

## Acknowledgments

- [Taostats](https://taostats.io) for the excellent Bittensor API
- [Awaken.tax](https://awaken.tax) for the CSV format specification and the vibe coding challenge
