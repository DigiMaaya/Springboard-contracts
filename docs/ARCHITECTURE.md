# Architecture Overview

Springboard is a token launchpad: projects raise stablecoin funding from investors under a fixed set of rules (time window, caps, optional whitelist), then distribute project tokens to those investors on a vesting schedule after the sale succeeds.

## The three contracts

```
                    ┌─────────────────────┐
                    │  SpringboardFactory   │   the control room — one per platform
                    └──────────┬───────────┘
                               │ deploys + registers
                               ▼
                    ┌─────────────────────┐
                    │     ProjectSale       │   the cash register — one per project
                    └──────────┬───────────┘
                               │ linked by address only
                               │ (no on-chain calls between them)
                               ▼
                    ┌─────────────────────┐
                    │   VestingContract      │   the drip feed — one per project
                    └─────────────────────┘
```

| Contract | One per... | Docs |
|---|---|---|
| `SpringboardFactory` | platform | [SPRINGBOARD_FACTORY.md](./SPRINGBOARD_FACTORY.md) |
| `ProjectSale` | project | [PROJECT_SALE.md](./PROJECT_SALE.md) |
| `VestingContract` | project | [VESTING_CONTRACT.md](./VESTING_CONTRACT.md) |

## How a project's lifecycle actually runs

1. **Deploy a `VestingContract`** for the project — independently, *not* via the Factory. Set its token address, TGE %, cliff, vesting duration/interval, and TGE date at deployment.
2. **Call `SpringboardFactory.createSale(...)`** with the project's sale parameters, including the `VestingContract` address from step 1. The Factory deploys a brand-new `ProjectSale` contract and registers it under a `projectId`.
   - Note: the Factory deploys `ProjectSale` directly (`new ProjectSale(...)`), not via a minimal proxy/clone. See [SPRINGBOARD_FACTORY.md](./SPRINGBOARD_FACTORY.md#deployment-pattern) for why.
3. **Investors contribute** stablecoins to `ProjectSale.contribute()` during the sale window, subject to min/max per-wallet limits, the hard cap, and (if enabled) a Merkle-proof whitelist check.
4. **Sale ends.** Two outcomes:
   - Soft cap met → admin calls `finalizeSale()`, all raised funds move to the immutable `treasury` address.
   - Soft cap missed → investors call `claimRefund()` individually to get their contribution back.
5. **Off-chain**, the team computes each investor's token allocation (contribution ÷ token price) and calls `VestingContract.setAllocations(...)` to record it.
6. **Investors claim** their vested tokens over time via `VestingContract.claim()` — a TGE percentage unlocks immediately at the vesting start date, nothing more unlocks during the cliff, then the remainder releases in even intervals.

`ProjectSale` stores the `VestingContract` address for reference only — it never calls into it. The two contracts are linked by address alone; all vesting logic runs independently.

## Key design decisions (and why)

| Decision | Reason |
|---|---|
| `ProjectSale` deployed directly, not via clone/proxy | Sale config uses Solidity `immutable` variables, which cannot vary correctly across minimal-proxy clones (they'd all share the implementation contract's baked-in values). Immutables also give the strongest possible guarantee that sale config can never change post-deployment — a requirement from the spec's guardrails section. See [SECURITY.md](./SECURITY.md). |
| One `VestingContract` per project, not shared | Each project has its own token and (potentially) its own vesting terms. A shared contract would need to track token type per user, adding complexity and risk for no real benefit at this scale. |
| Vesting terms (TGE%, cliff, duration, interval) are global per `VestingContract`, not per-beneficiary | Reviewed and confirmed with the client 2026-07-10 — every investor in a given project's sale shares identical vesting terms; only the allocation *amount* varies per person. Projects needing different terms for different investor tranches (e.g. advisors vs public) would deploy a separate `VestingContract` per tranche. |
| `contribute()` takes a Merkle proof parameter even when whitelisting is off | Needed to support the whitelist requirement from the spec. Callers pass `[]` when `whitelistRequired` is `false`. See [PROJECT_SALE.md](./PROJECT_SALE.md#whitelist--merkle-proofs) for how the backend generates proofs. |

## Full documentation index

See [README.md](../README.md) for the complete docs table of contents.
