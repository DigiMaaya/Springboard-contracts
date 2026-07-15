# Springboard Launchpad — Milestone 1 Timeline

> Calls happen every Friday. 4 Fridays total starting June 26, 2026.

---

## Friday 1 — June 26, 2026 | Project Kickoff & Setup
> Status: ✅ Complete

### Deliverables
- [x] Hardhat project scaffolded (dependencies, folder structure, config) — ✅ 2026-06-29
- [x] OpenZeppelin installed and configured — ✅ 2026-06-29
- [x] VestingContract written — ✅ 2026-06-29
- [x] VestingContract unit tests written and passing (32/32) — ✅ 2026-06-29

### Goal for call
Confirm project setup is solid and vesting logic is fully tested and working in isolation.

---

## Friday 2 — July 3, 2026 | Core Sale Logic
> Status: ✅ Complete

### Deliverables
- [x] ProjectSale contract written (contribute, caps, whitelist, refund, finalize, pause) — ✅ 2026-06-29
- [x] Merkle whitelist integration working — ✅ 2026-06-29
- [x] ProjectSale unit tests written and passing (46/46) — ✅ 2026-06-29
  - [x] Contribution flow — ✅ 2026-06-29
  - [x] Hard cap enforcement — ✅ 2026-06-29
  - [x] Soft cap failure + refund flow — ✅ 2026-06-29
  - [x] Finalization and treasury transfer — ✅ 2026-06-29
  - [x] Whitelist enforcement — ✅ 2026-06-29
  - [x] Pause and unpause — ✅ 2026-06-29

### Goal for call
Full ProjectSale contract reviewed and all test cases green.

---

## Friday 3 — July 10, 2026 | Factory + Integration
> Status: ✅ Complete

### Deliverables
- [x] SpringboardFactory contract written (createSale, getSale, getAllSales, pause, admin transfer) — ✅ 2026-07-10
- [x] Clone pattern or proxy wiring confirmed — ✅ 2026-07-10 (decided direct deployment over clones — ProjectSale's immutable config is incompatible with EIP-1167 proxies; setImplementation kept as reserved slot for future use)
- [x] Factory unit tests written and passing (21/21) — ✅ 2026-07-10
- [x] Integration tests across Factory → ProjectSale → Vesting (5/5) — ✅ 2026-07-10
- [x] Security guardrails verified (multisig roles, no fund movement by backend admin, locked config) — ✅ 2026-07-10

### Goal for call
All three contracts working together end-to-end, integration tests green.

---

## Friday 4 — July 17, 2026 | Deployment & Handoff
> Status: ✅ Complete

### Deliverables
- [x] All contracts deployed and verified on testnet — ✅ 2026-07-15 (BSC Testnet, all 5 contracts verified on BscScan)
- [x] Deployment scripts finalized for all three contracts — ✅ 2026-07-15 (`scripts/deploy.js`)
- [x] Contract ABIs exported — ✅ 2026-07-15 (`deliverables/abis/`)
- [x] Contract addresses documented — ✅ 2026-07-15 (`deliverables/addresses.json`)
- [x] ABI + address handoff package ready for backend team — ✅ 2026-07-15 (`deliverables/`, plus full contract docs in `docs/`)
- [x] Final checklist review — all items checked off — ✅ 2026-07-15

### Goal for call
Full Milestone 1 demo-ready. All deliverables handed off.

---

## Summary Table

| Friday | Date | Focus | Status |
|--------|------|--------|--------|
| Week 1 | Jun 26 | Setup + Vesting | ✅ Complete |
| Week 2 | Jul 3 | ProjectSale | ✅ Complete |
| Week 3 | Jul 10 | Factory + Integration | ✅ Complete |
| Week 4 | Jul 17 | Deploy + Handoff | ✅ Complete |
