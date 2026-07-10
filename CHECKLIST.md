# Springboard Launchpad — Milestone 1 Deliverables Checklist

## 1. SpringboardFactory Contract

### Functions
- [x] `createSale(projectId, tokenAddress, paymentToken, treasury, startTime, endTime, softCap, hardCap, minContribution, maxContribution, tokenPrice, totalAllocation, refundEnabled, whitelistRequired)` — deploys and registers a new ProjectSale contract — ✅ 2026-07-10
- [x] `getSale(projectId)` — returns sale contract address for a given project ID — ✅ 2026-07-10
- [x] `getAllSales()` — returns all registered sale contract addresses — ✅ 2026-07-10
- [x] `pauseFactory()` — pauses new sale deployments — ✅ 2026-07-10
- [x] `unpauseFactory()` — resumes new sale deployments — ✅ 2026-07-10
- [x] `setImplementation(newImplementation)` — ✅ 2026-07-10 (implemented as a reserved slot; sales are deployed directly via `new ProjectSale(...)` rather than clones — see note below)
- [x] `transferFactoryAdmin(newAdmin)` — transfers factory ownership to new admin — ✅ 2026-07-10

### Events
- [x] `SaleCreated(projectId, saleAddress, tokenAddress, paymentToken, timestamp)` — ✅ 2026-07-10
- [x] `FactoryPaused(admin, timestamp)` — ✅ 2026-07-10
- [x] `FactoryUnpaused(admin, timestamp)` — ✅ 2026-07-10
- [x] `ImplementationUpdated(oldImplementation, newImplementation, timestamp)` — ✅ 2026-07-10

> **Note on deployment pattern:** ProjectSale uses immutable constructor-set config per sale, so SpringboardFactory deploys full `ProjectSale` instances directly (`new ProjectSale(...)`) rather than EIP-1167 minimal proxy clones — clones would share the implementation's baked-in immutable values across all sales, which is incorrect. `setImplementation`/`implementation` are kept as a reserved, event-emitting slot for a future clone-based upgrade path but are not read by `createSale`. Decision confirmed with user on 2026-07-10.

---

## 2. ProjectSale Contract

### Functions
- [x] `contribute(amount)` — accepts stablecoin contribution from eligible user — ✅ 2026-06-29
- [x] `claimRefund()` — allows user to claim full refund if soft cap not reached — ✅ 2026-06-29
- [x] `finalizeSale()` — closes sale and transfers raised funds to treasury — ✅ 2026-06-29
- [x] `pauseSale()` — pauses contributions — ✅ 2026-06-29
- [x] `unpauseSale()` — resumes contributions — ✅ 2026-06-29
- [x] `setWhitelistRoot(merkleRoot)` — updates the Merkle whitelist root — ✅ 2026-06-29
- [x] `getUserContribution(user)` — returns total contributed amount for a wallet — ✅ 2026-06-29
- [x] `getSaleStatus()` — returns current sale state (raised amount, participant count, status) — ✅ 2026-06-29
- [x] `emergencyWithdraw()` — multisig-protected emergency function — ✅ 2026-06-29

### Events
- [x] `ContributionReceived(user, amount, timestamp)` — ✅ 2026-06-29
- [x] `SaleFinalized(totalRaised, totalParticipants, timestamp)` — ✅ 2026-06-29
- [x] `RefundClaimed(user, amount, timestamp)` — ✅ 2026-06-29
- [x] `SalePaused(admin, timestamp)` — ✅ 2026-06-29
- [x] `SaleUnpaused(admin, timestamp)` — ✅ 2026-06-29

---

## 3. Vesting Contract

### Functions
- [x] `claim()` — allows investor to claim currently unlocked tokens — ✅ 2026-06-29
- [x] `claimableAmount(user)` — returns tokens available to claim now — ✅ 2026-06-29
- [x] `vestedAmount(user)` — returns total tokens vested to date — ✅ 2026-06-29
- [x] `getVestingSchedule(user)` — returns full vesting schedule for a user — ✅ 2026-06-29
- [x] `setAllocations(users[], amounts[])` — batch-sets investor allocations before vesting begins — ✅ 2026-06-29

---

## 4. Security & Guardrails

- [ ] Factory owner is a multisig wallet
- [ ] Treasury wallet is a multisig wallet
- [x] Backend admin role cannot directly move or withdraw funds — ✅ 2026-06-29 (ProjectSale: emergencyWithdraw is MULTISIG_ROLE-only, destination fixed to treasury)
- [x] Project founder cannot modify sale parameters post-deployment without explicit admin approval — ✅ 2026-06-29 (ProjectSale config is immutable)
- [x] Emergency pause available at contract level — ✅ 2026-06-29
- [x] Emergency withdrawal requires multisig authorization — ✅ 2026-06-29
- [x] All critical admin actions emit on-chain events — ✅ 2026-06-29
- [x] Sale configuration locked at deployment (no silent changes) — ✅ 2026-06-29
- [x] Treasury wallet changes require multisig approval — ✅ 2026-07-10 (ProjectSale.treasury is immutable — no function exists to change it post-deployment, by anyone, at all)

---

## 5. Standards & Security Implementation

- [x] All contracts use audited OpenZeppelin libraries — ✅ 2026-07-10
- [x] Role-based access control on all admin functions — ✅ 2026-07-10
- [x] Reentrancy protection on all fund-handling functions — ✅ 2026-07-10
- [x] SafeERC20 used for all token transfers — ✅ 2026-07-10
- [x] Pausability implemented for emergency situations — ✅ 2026-07-10
- [x] No custom token transfer logic — ✅ 2026-07-10

---

## 6. Test Coverage

- [x] Contribution flow (happy path) — ✅ 2026-06-29
- [x] Hard cap enforcement — ✅ 2026-06-29
- [x] Soft cap failure and refund flow — ✅ 2026-06-29
- [x] Finalization and treasury transfer — ✅ 2026-06-29
- [x] Whitelist enforcement (Merkle proof) — ✅ 2026-06-29
- [x] Pause and unpause — ✅ 2026-06-29
- [x] Vesting cliff (no claim before cliff ends) — ✅ 2026-06-29
- [x] Vesting claim schedule (correct amounts per interval) — ✅ 2026-06-29
- [x] TGE unlock at start — ✅ 2026-06-29
- [x] Emergency controls — ✅ 2026-06-29

---

## 7. Deployment

- [ ] SpringboardFactory deployed and verified
- [ ] ProjectSale deployed and verified
- [ ] VestingContract deployed and verified
- [ ] Deployment scripts provided for all contracts
- [ ] Contract ABIs exported and documented
- [ ] Contract addresses documented
- [ ] ABI + address handoff package ready for backend team
