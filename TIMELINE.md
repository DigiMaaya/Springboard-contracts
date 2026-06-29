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
> Status: Upcoming

### Deliverables
- [ ] ProjectSale contract written (contribute, caps, whitelist, refund, finalize, pause)
- [ ] Merkle whitelist integration working
- [ ] ProjectSale unit tests written and passing
  - [ ] Contribution flow
  - [ ] Hard cap enforcement
  - [ ] Soft cap failure + refund flow
  - [ ] Finalization and treasury transfer
  - [ ] Whitelist enforcement
  - [ ] Pause and unpause

### Goal for call
Full ProjectSale contract reviewed and all test cases green.

---

## Friday 3 — July 10, 2026 | Factory + Integration
> Status: Upcoming

### Deliverables
- [ ] SpringboardFactory contract written (createSale, getSale, getAllSales, pause, admin transfer)
- [ ] Clone pattern or proxy wiring confirmed
- [ ] Factory unit tests written and passing
- [ ] Integration tests across Factory → ProjectSale → Vesting
- [ ] Security guardrails verified (multisig roles, no fund movement by backend admin, locked config)

### Goal for call
All three contracts working together end-to-end, integration tests green.

---

## Friday 4 — July 17, 2026 | Deployment & Handoff
> Status: Upcoming

### Deliverables
- [ ] All contracts deployed and verified on testnet
- [ ] Deployment scripts finalized for all three contracts
- [ ] Contract ABIs exported
- [ ] Contract addresses documented
- [ ] ABI + address handoff package ready for backend team
- [ ] Final checklist review — all items checked off

### Goal for call
Full Milestone 1 demo-ready. All deliverables handed off.

---

## Summary Table

| Friday | Date | Focus | Status |
|--------|------|--------|--------|
| Week 1 | Jun 26 | Setup + Vesting | ✅ Complete |
| Week 2 | Jul 3 | ProjectSale | Upcoming |
| Week 3 | Jul 10 | Factory + Integration | Upcoming |
| Week 4 | Jul 17 | Deploy + Handoff | Upcoming |
