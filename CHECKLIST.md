# Springboard Launchpad — Milestone 1 Deliverables Checklist

## 1. SpringboardFactory Contract

### Functions
- [ ] `createSale(projectId, tokenAddress, paymentToken, treasury, startTime, endTime, softCap, hardCap, minContribution, maxContribution, tokenPrice, totalAllocation, refundEnabled, whitelistRequired)` — deploys and registers a new ProjectSale contract
- [ ] `getSale(projectId)` — returns sale contract address for a given project ID
- [ ] `getAllSales()` — returns all registered sale contract addresses
- [ ] `pauseFactory()` — pauses new sale deployments
- [ ] `unpauseFactory()` — resumes new sale deployments
- [ ] `setImplementation(newImplementation)` — updates sale contract template (clone pattern)
- [ ] `transferFactoryAdmin(newAdmin)` — transfers factory ownership to new admin

### Events
- [ ] `SaleCreated(projectId, saleAddress, tokenAddress, paymentToken, timestamp)`
- [ ] `FactoryPaused(admin, timestamp)`
- [ ] `FactoryUnpaused(admin, timestamp)`
- [ ] `ImplementationUpdated(oldImplementation, newImplementation, timestamp)`

---

## 2. ProjectSale Contract

### Functions
- [ ] `contribute(amount)` — accepts stablecoin contribution from eligible user
- [ ] `claimRefund()` — allows user to claim full refund if soft cap not reached
- [ ] `finalizeSale()` — closes sale and transfers raised funds to treasury
- [ ] `pauseSale()` — pauses contributions
- [ ] `unpauseSale()` — resumes contributions
- [ ] `setWhitelistRoot(merkleRoot)` — updates the Merkle whitelist root
- [ ] `getUserContribution(user)` — returns total contributed amount for a wallet
- [ ] `getSaleStatus()` — returns current sale state (raised amount, participant count, status)
- [ ] `emergencyWithdraw()` — multisig-protected emergency function

### Events
- [ ] `ContributionReceived(user, amount, timestamp)`
- [ ] `SaleFinalized(totalRaised, totalParticipants, timestamp)`
- [ ] `RefundClaimed(user, amount, timestamp)`
- [ ] `SalePaused(admin, timestamp)`
- [ ] `SaleUnpaused(admin, timestamp)`

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
- [ ] Backend admin role cannot directly move or withdraw funds
- [ ] Project founder cannot modify sale parameters post-deployment without explicit admin approval
- [ ] Emergency pause available at contract level
- [ ] Emergency withdrawal requires multisig authorization
- [ ] All critical admin actions emit on-chain events
- [ ] Sale configuration locked at deployment (no silent changes)
- [ ] Treasury wallet changes require multisig approval

---

## 5. Standards & Security Implementation

- [ ] All contracts use audited OpenZeppelin libraries
- [ ] Role-based access control on all admin functions
- [ ] Reentrancy protection on all fund-handling functions
- [ ] SafeERC20 used for all token transfers
- [ ] Pausability implemented for emergency situations
- [ ] No custom token transfer logic

---

## 6. Test Coverage

- [ ] Contribution flow (happy path)
- [ ] Hard cap enforcement
- [ ] Soft cap failure and refund flow
- [ ] Finalization and treasury transfer
- [ ] Whitelist enforcement (Merkle proof)
- [ ] Pause and unpause
- [x] Vesting cliff (no claim before cliff ends) — ✅ 2026-06-29
- [x] Vesting claim schedule (correct amounts per interval) — ✅ 2026-06-29
- [x] TGE unlock at start — ✅ 2026-06-29
- [ ] Emergency controls

---

## 7. Deployment

- [ ] SpringboardFactory deployed and verified
- [ ] ProjectSale deployed and verified
- [ ] VestingContract deployed and verified
- [ ] Deployment scripts provided for all contracts
- [ ] Contract ABIs exported and documented
- [ ] Contract addresses documented
- [ ] ABI + address handoff package ready for backend team
