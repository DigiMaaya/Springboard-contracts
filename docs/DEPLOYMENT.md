# Deployment Guide

## Prerequisites

Install dependencies:
```bash
npm install
```

Create a `.env` file in the project root (gitignored — never commit this):
```bash
BSC_TESTNET_RPC_URL=<your RPC endpoint, e.g. from Alchemy>
DEPLOYER_PRIVATE_KEY=<deployer wallet private key>
BSCSCAN_API_KEY=<API key from bscscan.com, for source verification>
```

**Never paste private keys directly into chat/logs.** Put them straight into `.env`. Treat any key that has appeared in a chat transcript, terminal log, or screen share as compromised — rotate away from it for anything beyond disposable testnet use.

## Networks

Configured in `hardhat.config.js`:

| Network | Chain ID | Use |
|---|---|---|
| `hardhat` | — | local, ephemeral, used for the test suite |
| `bscTestnet` | 97 | testnet validation deployments |
| `sepolia` | 11155111 | (configured, unused so far) |

## Deploying

`scripts/deploy.js` performs a **clean deployment with no post-deploy activity**:
1. Deploys mock `paymentToken` and `projectToken` (testnet only — see [note below](#mainnet-differences))
2. Deploys `VestingContract`
3. Deploys `SpringboardFactory`
4. Registers one `ProjectSale` via `factory.createSale()`
5. Writes a deployment record to `deployments/<network>.json` (addresses + constructor args, for use in verification and the ABI/address handoff package)

It does **not** call `contribute`, `finalizeSale`, `claimRefund`, `setAllocations`, or `claim` — those are left for whoever actually runs the project's sale.

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js --network bscTestnet
```

Check the deployer's balance first if unsure it has enough gas:
```bash
npx hardhat run scripts/checkBalance.js --network bscTestnet
```

### End-to-end validation (optional, testnet only)

`scripts/deployAndTestBscTestnet.js` deploys a fresh set of contracts *and* walks the full lifecycle live on-chain (contribute → finalize → vesting allocation → claim), using short time windows so it completes in a few minutes. Useful for confirming the whole system works together on a live network before doing a "real" deployment, but it does perform full sale activity — don't run it against contracts you intend to actually use.

```bash
npx hardhat run scripts/deployAndTestBscTestnet.js --network bscTestnet
```

## Verifying contracts on the block explorer

Uses the unified Etherscan V2 API (a single `BSCSCAN_API_KEY` works across supported chains, configured as a flat string in `hardhat.config.js`'s `etherscan.apiKey`, not a per-network object).

Simple constructors (flat args):
```bash
npx hardhat verify --network bscTestnet <address> <constructor-arg-1> <constructor-arg-2> ...
```

`ProjectSale` takes a single struct argument, which the CLI can't express as flat args — use a constructor-args file instead (see `scripts/verify-args/projectSale.js` for a working example):
```bash
npx hardhat verify --network bscTestnet --constructor-args scripts/verify-args/projectSale.js <address>
```

If BscScan reports a contract as "already verified" on a fresh deployment, that's normal — it means the bytecode is byte-for-byte identical to a contract it already has source for (common for the unmodified `ERC20Mock`).

## After deploying

1. Update `deliverables/addresses.json` and `deliverables/abis/*.json` if contracts changed — see the [deliverables README](../deliverables/README.md).
2. Check off the relevant items in [CHECKLIST.md](./CHECKLIST.md), with the date.

## Mainnet differences

Before deploying to mainnet, the following **must** change from the testnet setup used so far:

- **`paymentToken`** must be the real USDC/USDT contract address on the target chain — not `ERC20Mock`.
- **`SpringboardFactory`'s admin** and **every `ProjectSale`'s `treasury`** must be multisig wallets (e.g. Gnosis Safe), not single-key EOAs. This is not enforced by the contracts — see [HANDOFF.md](./HANDOFF.md) for why and what's required.
- Review `docs/SECURITY.md` for the full list of guardrails and confirmed spec deviations before going live.
