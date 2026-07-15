# Security & Guardrails

## Role-based access control, across all three contracts

| Contract | Role | Holder | Powers |
|---|---|---|---|
| `SpringboardFactory` | `DEFAULT_ADMIN_ROLE` / `ADMIN_ROLE` | constructor `_admin` (**must be multisig on mainnet**) | `createSale`, `pauseFactory`, `unpauseFactory`, `setImplementation`, `transferFactoryAdmin` |
| `ProjectSale` | `DEFAULT_ADMIN_ROLE` / `ADMIN_ROLE` | whoever called `createSale` | `finalizeSale`, `pauseSale`, `unpauseSale`, `setWhitelistRoot` |
| `ProjectSale` | `MULTISIG_ROLE` | granted explicitly, separate from `ADMIN_ROLE` | `emergencyWithdraw` **only** |
| `VestingContract` | `DEFAULT_ADMIN_ROLE` / `ADMIN_ROLE` | constructor `_admin` | `setAllocations`, `lockAllocations`, `pauseVesting`, `unpauseVesting` |

The critical separation: **`ADMIN_ROLE` on `ProjectSale` cannot call `emergencyWithdraw`.** Only a distinct `MULTISIG_ROLE` can, and it must be granted separately after deployment (it is not granted automatically to anyone, including the sale admin).

## Fund-movement guarantees

- `finalizeSale()` and `emergencyWithdraw()` both send funds to `treasury` — an **immutable** address set once at `ProjectSale` deployment. There is no function anywhere in the contract that can redirect funds to any other address, by anyone, ever.
- All fund-handling functions (`contribute`, `claimRefund`, `finalizeSale`, `emergencyWithdraw`, `claim`) use OpenZeppelin's `nonReentrant` modifier.
- All token transfers use OpenZeppelin's `SafeERC20` — no raw `.transfer()`/`.transferFrom()` calls anywhere in the codebase.

## Immutability

Every sale parameter on `ProjectSale` (caps, times, treasury, token addresses, price, allocation, flags) is a Solidity `immutable`, set once in the constructor. **No function exists to change any of them after deployment** — not the admin, not the founder, not anyone. This is a stronger guarantee than "requires approval to change": the change path simply doesn't exist in the contract.

## Multisig requirements — not enforced in code

Two guardrails from the original spec **cannot be enforced by the smart contracts themselves**, because Solidity cannot verify that an address is a multisig (e.g. a Gnosis Safe) versus a regular single-key wallet:

- **`SpringboardFactory`'s admin must be a multisig.**
- **Each `ProjectSale`'s `treasury` must be a multisig.**

These are operational requirements for whoever deploys to mainnet — see [HANDOFF.md](./HANDOFF.md) for the full explanation and what's required before going live.

## Known deviations from the original spec (all reviewed and confirmed)

| Deviation | Reason | Confirmed |
|---|---|---|
| `SpringboardFactory` deploys `ProjectSale` directly, not via clone/proxy pattern | Immutable sale config is incompatible with minimal-proxy clones; also gives a stronger "locked at deployment" guarantee | 2026-07-10 |
| `contribute(amount)` → actual signature is `contribute(amount, bytes32[] merkleProof)` | Required to support the whitelist feature also listed in the spec | see [PROJECT_SALE.md](./PROJECT_SALE.md#whitelist--merkle-proofs) |
| Vesting terms (TGE%, cliff, duration, interval, start date) are global per `VestingContract`, not per-beneficiary | Simplifies the common case (uniform terms per project); different terms require a separate `VestingContract` deployment | 2026-07-10 |
| `setImplementation()` on the Factory has no functional effect on deployment | Reserved for a possible future clone-based upgrade path; kept for spec's literal function/event list | 2026-07-10 |

## Test coverage

116/116 tests passing. Verified via `hardhat coverage`:
- **100%** statement, line, and function coverage across all three contracts
- **96.4%** branch coverage (remaining gap is OpenZeppelin's own internal reentrancy-guard logic, not custom code)

Run locally:
```bash
npx hardhat test
npx hardhat coverage
```
