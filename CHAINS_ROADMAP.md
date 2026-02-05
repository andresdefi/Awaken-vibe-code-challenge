# Chains Roadmap

Track progress of chain integrations to match/exceed AwakenFetch coverage.

## Implemented Chains

- [x] Bittensor (TAO) - Taostats API
- [x] Polkadot (DOT) - Subscan API
- [x] Kusama (KSM) - Subscan API
- [x] Osmosis (OSMO) - Numia API
- [x] Injective (INJ) - Indexer API
- [x] Ronin (RON) - Moralis API
- [x] dYdX (DYDX) - Indexer API (perps)
- [x] Extended (perps) - StarkNet API
- [x] Canton (CC) - Canton API
- [x] Hedera (HBAR) - Mirror Node API
- [x] XRPL (XRP) - XRPL Data API
- [x] Kava (KAVA) - Kava API + Moralis EVM
- [x] Stellar (XLM) - Horizon API

## Chains to Add (from AwakenFetch)

### Priority 1: Kaspa
- [ ] **Kaspa (KAS)**
  - API: `https://api.kaspa.org`
  - Endpoints:
    - `/addresses/{address}/full-transactions` - transaction history (paginated)
    - `/info/price` - current USD price
  - Address format: `kaspa:` prefix + bech32 encoded
  - Transaction types: transfers (UTXO-based, like Bitcoin)
  - Decimals: 8 (1 KAS = 100,000,000 sompi)
  - Notes: Simple UTXO chain, no staking/smart contracts

### Priority 2: MultiversX (formerly Elrond)
- [ ] **MultiversX (EGLD)**
  - API: `https://api.multiversx.com`
  - Address format: `erd1` prefix (bech32)
  - Transaction types: transfers, staking, delegation, smart contracts
  - Decimals: 18
  - Notes: Has ESDT tokens (like ERC-20)

### Priority 3: Radix
- [ ] **Radix (XRD)**
  - API: Gateway API
  - Address format: `rdx1` prefix
  - Transaction types: transfers, staking, liquidity
  - Notes: Unique transaction model (manifests)

### Priority 4: Ergo
- [ ] **Ergo (ERG)**
  - API: Explorer API
  - Address format: `9` prefix (base58)
  - Transaction types: transfers (UTXO-based)
  - Decimals: 9

## Not Implementing

- **Variational** - Confirmed cannot implement (missing API/documentation)

## Implementation Checklist for Each Chain

1. [ ] Create `src/lib/chains/{chain}/types.ts` - API response types
2. [ ] Create `src/lib/chains/{chain}/api.ts` - API fetch functions
3. [ ] Create `src/lib/chains/{chain}/utils.ts` - address validation, unit conversion
4. [ ] Create `src/lib/chains/{chain}/transactions.ts` - normalize to Awaken format
5. [ ] Create `src/app/api/{chain}/transactions/route.ts` - API route
6. [ ] Add chain to `src/app/page.tsx` CHAINS config
7. [ ] Add chain to `src/lib/chain-config.ts` explorer URLs
8. [ ] Add chain to `src/components/chain-logo.tsx` (logo + names)
9. [ ] Add tests for API and normalization
10. [ ] Test end-to-end with real wallet address
