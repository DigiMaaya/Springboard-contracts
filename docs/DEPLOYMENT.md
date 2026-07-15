# Deployment Guide

## Prerequisites

Install dependencies:
```bash
npm install
```

Create a `.env` file in the project root (gitignored: never commit this):
```bash
BSC_TESTNET_RPC_URL=<your RPC endpoint, e.g. from Alchemy>
DEPLOYER_PRIVATE_KEY=<deployer wallet private key>
BSCSCAN_API_KEY=<API key from bscscan.com, for source verification>
```

**Never paste private keys directly into chat/logs.** Put them straight into `.env`. Treat any key that has appeared in a chat transcript, terminal log, or screen share as compromised: rotate away from it for anything beyond disposable testnet use.

## Networks

Configured in `hardhat.config.js`:

| Network | Chain ID | Use |
|---|---|---|
| `hardhat` | n/a | local, ephemeral, used for the test suite |
| `bscTestnet` | 97 | testnet deployments |

## Deploying

There are three deployment scripts, for three different purposes. Check the deployer's balance first if unsure it has enough gas:
```bash
npx hardhat run scripts/checkBalance.js --network bscTestnet
```

### Production pattern: `scripts/deploySpringboardFactory.js`

This is the **real deployment pattern**. `SpringboardFactory` is a platform-level contract, deployed **once**. Each project's `ProjectSale` and `VestingContract` are created **later**, on demand, as a separate operational step, whenever an actual project is ready to launch — not bundled into the platform deployment.

```bash
npx hardhat compile
npx hardhat run scripts/deploySpringboardFactory.js --network bscTestnet
```

Set `FACTORY_ADMIN` in `.env` to deploy with a specific admin address (this **must be a multisig on mainnet**, see [HANDOFF.md](./HANDOFF.md)). If unset, defaults to the deployer's own address, which is only appropriate for testnet.

Writes a deployment record to `deployments/<network>-factory.json`.

**Creating a project's sale afterward** (separate step, whenever a project launches): deploy that project's `VestingContract` independently, then call `factory.createSale({...})` with the vesting address included, using the Factory address from the deployment record above.

### Demo / reference: `scripts/deployWithSampleProject.js`

Deploys the full stack — mocks, `VestingContract`, `SpringboardFactory` — **and** registers one sample/dummy `ProjectSale` via `createSale()`, so you have working instances of all three contract types to inspect or verify. Performs no further activity (no `contribute`, `finalizeSale`, `claimRefund`, `setAllocations`, or `claim`).

This is **not** the production pattern above — it exists for demos, walkthroughs, and to satisfy "all three contracts deployed and verified" style acceptance criteria on testnet.

```bash
npx hardhat run scripts/deployWithSampleProject.js --network bscTestnet
```

Writes a deployment record to `deployments/<network>.json`.

### Full end-to-end validation: `scripts/deployAndTestBscTestnet.js`

Deploys a fresh set of contracts *and* walks the full lifecycle live on-chain (contribute → finalize → vesting allocation → claim), using short time windows so it completes in a few minutes. Useful for confirming the whole system works together on a live network after a code change, but it performs full sale activity: don't run it against contracts you intend to actually use.

```bash
npx hardhat run scripts/deployAndTestBscTestnet.js --network bscTestnet
```

## Verifying contracts on the block explorer

Uses the unified Etherscan V2 API (a single `BSCSCAN_API_KEY` works across supported chains, configured as a flat string in `hardhat.config.js`'s `etherscan.apiKey`, not a per-network object).

Simple constructors (flat args):
```bash
npx hardhat verify --network bscTestnet <address> <constructor-arg-1> <constructor-arg-2> ...
```

`ProjectSale` takes a single struct argument, which the CLI can't express as flat args: use a constructor-args file instead. Create a small JS file exporting the exact `SaleParams` struct used for that deployment (values available in `deployments/<network>.json`), for example:
```js
// verify-args.js
module.exports = [
  {
    projectId: 1,
    tokenAddress: "0x...",
    paymentToken: "0x...",
    treasury: "0x...",
    startTime: 1234567890,
    endTime: 1234567890,
    softCap: "1000000000000000000000",
    hardCap: "5000000000000000000000",
    minContribution: "10000000000000000000",
    maxContribution: "2000000000000000000000",
    tokenPrice: "500000000000000000",
    totalAllocation: "10000000000000000000000",
    vestingContract: "0x...",
    refundEnabled: true,
    whitelistRequired: false,
    admin: "0x...",
  },
];
```
```bash
npx hardhat verify --network bscTestnet --constructor-args verify-args.js <address>
```
Treat this file as throwaway per-deployment scratch work, not a committed artifact — it goes stale the moment a new sale is created with different parameters.

If BscScan reports a contract as "already verified" on a fresh deployment, that's normal: it means the bytecode is byte-for-byte identical to a contract it already has source for (common for the unmodified `ERC20Mock`).

## After deploying

1. Update `deliverables/addresses.json` and `deliverables/abis/*.json` if contracts changed: see the [deliverables README](../deliverables/README.md).
2. Check off the relevant items in [CHECKLIST.md](./CHECKLIST.md), with the date.

## Mainnet differences

Before deploying to mainnet, the following **must** change from the testnet setup used so far:

- **`paymentToken`** must be the real USDC/USDT contract address on the target chain: not `ERC20Mock`.
- **`SpringboardFactory`'s admin** and **every `ProjectSale`'s `treasury`** must be multisig wallets (e.g. Gnosis Safe), not single-key EOAs. This is not enforced by the contracts: see [HANDOFF.md](./HANDOFF.md) for why and what's required.
- Review `docs/SECURITY.md` for the full list of guardrails and confirmed spec deviations before going live.
