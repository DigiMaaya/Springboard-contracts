# Handoff Notes — Springboard Launchpad Smart Contracts

> **Read this before deploying to mainnet.** This document covers operational
> setup steps that are outside the scope of the smart contract code itself and
> must be completed by the team taking ownership of this project.

---

## ⚠️ Required before mainnet deployment: Multisig wallets

The contracts in this repo are built to require multisig control at two points.
**Neither multisig is created or configured by this codebase** — they must be
set up independently (e.g. via [Gnosis Safe](https://safe.global)) by whoever
owns the project going forward, before deploying to mainnet.

### 1. Factory owner must be a multisig wallet

`SpringboardFactory` is deployed with a single `_admin` address passed to its
constructor (see `contracts/SpringboardFactory.sol`). That address receives
`DEFAULT_ADMIN_ROLE` and `ADMIN_ROLE`, and controls:
- `createSale(...)` — deploying every new project's sale contract
- `pauseFactory()` / `unpauseFactory()`
- `transferFactoryAdmin(...)` — handing off factory control

**This address must be a multisig**, not a single EOA (externally owned
account / regular wallet), before any real funds or projects go live. A
single-key admin here is a single point of failure for the entire launchpad.

### 2. Treasury wallet must be a multisig wallet

Each `ProjectSale` is deployed with an immutable `treasury` address (see
`contracts/ProjectSale.sol`). All raised funds — via `finalizeSale()` and
`emergencyWithdraw()` — are sent to this address, and **only** this address.
There is no function anywhere in the contract to redirect funds elsewhere,
by design.

**This address must be a multisig**, because:
- It is immutable — set once at sale deployment and can never be changed.
- It receives 100% of raised investor funds when a sale finalizes.
- A single lost or compromised key here means a total, unrecoverable loss of
  project funds.

### What is NOT handled by this codebase

- Creating the Gnosis Safe (or equivalent) contracts
- Choosing/onboarding signers and setting the signing threshold (e.g. 3-of-5)
- Any key management, hardware wallet setup, or signer operational security
- Ongoing multisig governance/process (who approves what, and how)

These are organizational decisions for the team operating Springboard, made
**before** calling the Factory's or ProjectSale's constructors with real
addresses. The contracts enforce *that* a multisig should be there (via the
role/immutability design) but cannot enforce *that the address you pass in
is actually a multisig* — that's on whoever runs the deployment script.

---

## Status of other guardrails (for reference)

These are implemented in code and covered by tests — see `CHECKLIST.md`
Section 4 for the full list:
- Backend admin role cannot move or withdraw funds (only `MULTISIG_ROLE` can
  call `emergencyWithdraw()`, and it always sends to the immutable treasury)
- Sale configuration is immutable after deployment
- All critical admin actions emit on-chain events
- Emergency pause available at contract level

---

## Deployment checklist order (recommended)

1. Set up the Factory-owner multisig and the treasury multisig(s) first.
2. Deploy `SpringboardFactory` with the Factory-owner multisig address as `_admin`.
3. For each project, deploy via `factory.createSale(...)` with that project's
   treasury multisig address in the params.
4. Deploy `VestingContract` per project as needed, with allocations set only
   after the sale is finalized.

See `CHECKLIST.md` Section 7 (Deployment) for the remaining deployment
scripts, ABI export, and address documentation deliverables.
