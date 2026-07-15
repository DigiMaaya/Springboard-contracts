# Springboard

Smart contract system for the Springboard token launchpad: Milestone 1. A permissioned launchpad where projects raise stablecoin funding from investors under a fixed set of rules, then distribute tokens on a vesting schedule after the sale succeeds.

## Contracts

| Contract | Purpose | Source | Docs |
|---|---|---|---|
| `SpringboardFactory` | Master control contract: deploys and registers a `ProjectSale` for each new project | [`contracts/SpringboardFactory.sol`](./contracts/SpringboardFactory.sol) | [docs/SPRINGBOARD_FACTORY.md](./docs/SPRINGBOARD_FACTORY.md) |
| `ProjectSale` | Per-project fundraising: contributions, caps, whitelist, refunds, finalization | [`contracts/ProjectSale.sol`](./contracts/ProjectSale.sol) | [docs/PROJECT_SALE.md](./docs/PROJECT_SALE.md) |
| `VestingContract` | Per-project token distribution: TGE unlock, cliff, linear vesting | [`contracts/VestingContract.sol`](./contracts/VestingContract.sol) | [docs/VESTING_CONTRACT.md](./docs/VESTING_CONTRACT.md) |

Latest deployed addresses (BSC Testnet): [`deliverables/addresses.json`](./deliverables/addresses.json). ABIs: [`deliverables/abis/`](./deliverables/abis/).

## Documentation

| Doc | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System overview, how the three contracts connect, full project lifecycle, key design decisions |
| [docs/SPRINGBOARD_FACTORY.md](./docs/SPRINGBOARD_FACTORY.md) | Factory roles, functions, events, deployment pattern |
| [docs/PROJECT_SALE.md](./docs/PROJECT_SALE.md) | Sale lifecycle, functions, events, **Merkle whitelist proof guide for backend integration** |
| [docs/VESTING_CONTRACT.md](./docs/VESTING_CONTRACT.md) | Vesting math (TGE/cliff/linear release), functions, events |
| [docs/SECURITY.md](./docs/SECURITY.md) | RBAC roles across all contracts, fund-movement guarantees, confirmed spec deviations, test coverage |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | How to deploy, verify on BscScan, and what changes for mainnet |
| [docs/HANDOFF.md](./docs/HANDOFF.md) | **Read before mainnet deployment**: multisig setup required for Factory admin and treasury wallets, not enforced in code |
| [docs/CHECKLIST.md](./docs/CHECKLIST.md) | Full deliverables checklist against the original spec, with completion dates |
| [docs/TIMELINE.md](./docs/TIMELINE.md) | Weekly delivery timeline |

## Quick start

```bash
npm install
npx hardhat compile
npx hardhat test
npx hardhat coverage
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for deploying to a live network.
