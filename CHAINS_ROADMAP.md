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
- [x] Kaspa (KAS) - Kaspa API (`api.kaspa.org`)
- [x] MultiversX (EGLD) - MultiversX API (`api.multiversx.com`)

## Chains to Add (from AwakenFetch)

### Priority 1: Radix
- [ ] **Radix (XRD)**
  - API: Gateway API
  - Address format: `rdx1` prefix
  - Transaction types: transfers, staking, liquidity
  - Notes: Unique transaction model (manifests)

### Priority 2: Ergo
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
