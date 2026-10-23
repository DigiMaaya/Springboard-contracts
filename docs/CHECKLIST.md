# Springboard Launchpad: Milestone 1 Deliverables Checklist

## 1. SpringboardFactory Contract

### Functions
- [x] `createSale(projectId, tokenAddress, paymentToken, treasury, startTime, endTime, softCap, hardCap, minContribution, maxContribution, tokenPrice, totalAllocation, refundEnabled, whitelistRequired)`: deploys and registers a new ProjectSale contract: ✅ 2026-07-10
- [x] `getSale(projectId)`: returns sale contract address for a given project ID: ✅ 2026-07-10
- [x] `getAllSales()`: returns all registered sale contract addresses: ✅ 2026-07-10
- [x] `pauseFactory()`: pauses new sale deployments: ✅ 2026-07-10
- [x] `unpauseFactory()`: resumes new sale deployments: ✅ 2026-07-10
- [x] `setImplementation(newImplementation)`: ✅ 2026-07-10 (implemented as a reserved slot; sales are deployed directly via `new ProjectSale(...)` rather than clones: see note below)
- [x] `transferFactoryAdmin(newAdmin)`: transfers factory ownership to new admin: ✅ 2026-07-10

### Events
- [x] `SaleCreated(projectId, saleAddress, tokenAddress, paymentToken, timestamp)`: ✅ 2026-07-10
- [x] `FactoryPaused(admin, timestamp)`: ✅ 2026-07-10
- [x] `FactoryUnpaused(admin, timestamp)`: ✅ 2026-07-10
- [x] `ImplementationUpdated(oldImplementation, newImplementation, timestamp)`: ✅ 2026-07-10

> **Note on deployment pattern:** ProjectSale uses immutable constructor-set config per sale, so SpringboardFactory deploys full `ProjectSale` instances directly (`new ProjectSale(...)`) rather than EIP-1167 minimal proxy clones: clones would share the implementation's baked-in immutable values across all sales, which is incorrect. `setImplementation`/`implementation` are kept as a reserved, event-emitting slot for a future clone-based upgrade path but are not read by `createSale`. Decision confirmed with user on 2026-07-10.

---

## 2. ProjectSale Contract

### Functions
- [x] `contribute(amount)`: accepts stablecoin contribution from eligible user: ✅ 2026-06-29
- [x] `claimRefund()`: allows user to claim full refund if soft cap not reached: ✅ 2026-06-29
- [x] `finalizeSale()`: closes sale and transfers raised funds to treasury: ✅ 2026-06-29
- [x] `pauseSale()`: pauses contributions: ✅ 2026-06-29
- [x] `unpauseSale()`: resumes contributions: ✅ 2026-06-29
- [x] `setWhitelistRoot(merkleRoot)`: updates the Merkle whitelist root: ✅ 2026-06-29
- [x] `getUserContribution(user)`: returns total contributed amount for a wallet: ✅ 2026-06-29
- [x] `getSaleStatus()`: returns current sale state (raised amount, participant count, status): ✅ 2026-06-29
- [x] `emergencyWithdraw()`: multisig-protected emergency function: ✅ 2026-06-29

### Events
- [x] `ContributionReceived(user, amount, timestamp)`: ✅ 2026-06-29
- [x] `SaleFinalized(totalRaised, totalParticipants, timestamp)`: ✅ 2026-06-29
- [x] `RefundClaimed(user, amount, timestamp)`: ✅ 2026-06-29
- [x] `SalePaused(admin, timestamp)`: ✅ 2026-06-29
- [x] `SaleUnpaused(admin, timestamp)`: ✅ 2026-06-29

---

## 3. Vesting Contract

### Functions
- [x] `claim()`: allows investor to claim currently unlocked tokens: ✅ 2026-06-29
- [x] `claimableAmount(user)`: returns tokens available to claim now: ✅ 2026-06-29
- [x] `vestedAmount(user)`: returns total tokens vested to date: ✅ 2026-06-29
- [x] `getVestingSchedule(user)`: returns full vesting schedule for a user: ✅ 2026-06-29
- [x] `setAllocations(users[], amounts[])`: batch-sets investor allocations before vesting begins: ✅ 2026-06-29

> **Note on per-beneficiary parameters:** spec section 1.3 lists TGE%, cliff duration, vesting duration, vesting interval, and vesting start date as "parameters per beneficiary." In this implementation, those are set **once globally** for the whole VestingContract at deployment: every beneficiary in a given project shares identical vesting terms; only `totalAllocation` varies per beneficiary via `setAllocations`. This was reviewed with the user on 2026-07-10 and confirmed to stay as-is for now. If a project later needs beneficiary-specific terms (e.g. advisors on a different schedule than public investors), that requires either a separate `VestingContract` deployment for that group, or a future contract change to accept per-beneficiary schedule params.

---

## 4. Security & Guardrails

- [ ] Factory owner is a multisig wallet: **operational task, not code.** See [HANDOFF.md](./HANDOFF.md) for details; must be set up by the receiving team before mainnet deployment.
- [ ] Treasury wallet is a multisig wallet: **operational task, not code.** See [HANDOFF.md](./HANDOFF.md) for details; must be set up by the receiving team before mainnet deployment.
- [x] Backend admin role cannot directly move or withdraw funds: ✅ 2026-06-29 (ProjectSale: emergencyWithdraw is MULTISIG_ROLE-only, destination fixed to treasury)
- [x] Project founder cannot modify sale parameters post-deployment without explicit admin approval: ✅ 2026-06-29 (ProjectSale config is immutable)
- [x] Emergency pause available at contract level: ✅ 2026-06-29
- [x] Emergency withdrawal requires multisig authorization: ✅ 2026-06-29
- [x] All critical admin actions emit on-chain events: ✅ 2026-06-29
- [x] Sale configuration locked at deployment (no silent changes): ✅ 2026-06-29
- [x] Treasury wallet changes require multisig approval: ✅ 2026-07-10 (ProjectSale.treasury is immutable: no function exists to change it post-deployment, by anyone, at all)

---

## 5. Standards & Security Implementation

- [x] All contracts use audited OpenZeppelin libraries: ✅ 2026-07-10
- [x] Role-based access control on all admin functions: ✅ 2026-07-10
- [x] Reentrancy protection on all fund-handling functions: ✅ 2026-07-10
- [x] SafeERC20 used for all token transfers: ✅ 2026-07-10
- [x] Pausability implemented for emergency situations: ✅ 2026-07-10
- [x] No custom token transfer logic: ✅ 2026-07-10

---

## 6. Test Coverage

- [x] Contribution flow (happy path): ✅ 2026-06-29
- [x] Hard cap enforcement: ✅ 2026-06-29
- [x] Soft cap failure and refund flow: ✅ 2026-06-29
- [x] Finalization and treasury transfer: ✅ 2026-06-29
- [x] Whitelist enforcement (Merkle proof): ✅ 2026-06-29
- [x] Pause and unpause: ✅ 2026-06-29
- [x] Vesting cliff (no claim before cliff ends): ✅ 2026-06-29
- [x] Vesting claim schedule (correct amounts per interval): ✅ 2026-06-29
- [x] TGE unlock at start: ✅ 2026-06-29
- [x] Emergency controls: ✅ 2026-06-29

---

## 7. Deployment

- [x] SpringboardFactory deployed and verified: ✅ 2026-07-15 (BSC Testnet, `0x2acCe2C92BdCb5735FDDda57FBA7758f851fE8ab`)
- [x] ProjectSale deployed and verified: ✅ 2026-07-15 (BSC Testnet, `0xd599d8305519146D64B447870D7860966E67d7c5`)
- [x] VestingContract deployed and verified: ✅ 2026-07-15 (BSC Testnet, `0x0a9Ebb15230550D46cC8c3f74635103a65397aAE`)
- [x] Deployment scripts provided for all contracts: ✅ 2026-07-15 (`scripts/deploySpringboardFactory.js` for the production pattern, `scripts/deployWithSampleProject.js` for full-stack demo deployment)
- [x] Contract ABIs exported and documented: ✅ 2026-07-15 (`deliverables/abis/*.json`, documented in `deliverables/README.md`)
- [x] Contract addresses documented: ✅ 2026-07-15 (`deployments/bscTestnet.json`, `deliverables/addresses.json`)
- [x] ABI + address handoff package ready for backend team: ✅ 2026-07-15 (`deliverables/` folder, plus full docs in `docs/`)
- [x] Second network (Ethereum Sepolia) deployed and verified: ✅ 2026-09-07 (SpringboardFactory `0xcE5380800454780eF43a97F2A7548051Bc604F1E`, ProjectSale `0x894C4322E13347f4D7688f029e06E9c8ff755Dfc`, VestingContract `0x54F344d4ce328B6E321821D687f3F8634425623e`)
- [x] SpringboardFactory deployed to BSC Mainnet: ✅ 2026-10-23 (`0xec1B63488c1E502719a350F889f7264553F96266`, not yet verified on BscScan; admin is still the deployer's own EOA, not a multisig: see [HANDOFF.md](./HANDOFF.md) before registering any real project)

> **Note:** BSC Testnet and Ethereum Sepolia are testnet deployments for validation purposes. SpringboardFactory is now also live on BSC Mainnet, but its admin has not yet been transferred to a multisig: see [HANDOFF.md](./HANDOFF.md) before any real project launches on it. Verified contract source: see BscScan/Etherscan links in [`../deployments/bscTestnet.json`](../deployments/bscTestnet.json), [`../deployments/sepolia.json`](../deployments/sepolia.json), [`../deployments/bsc-factory.json`](../deployments/bsc-factory.json), and the handoff-ready [`../deliverables/addresses.json`](../deliverables/addresses.json).
