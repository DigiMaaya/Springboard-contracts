# VestingContract

`contracts/VestingContract.sol`

Manages token distribution after a sale succeeds: a TGE unlock, a cliff, then linear release over fixed intervals. One deployed per project, **independently**: the Factory does not deploy or manage vesting contracts. See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Roles

| Role | Granted to | Can do |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` / `ADMIN_ROLE` | constructor `_admin` | `setAllocations`, `lockAllocations`, `pauseVesting`, `unpauseVesting` |

## Constructor

```solidity
constructor(
    address _token,
    address _admin,
    uint256 _tgePercent,       // e.g. 10 = 10%
    uint256 _cliffDuration,    // seconds
    uint256 _vestingDuration,  // seconds, post-cliff linear release period
    uint256 _vestingInterval,  // seconds between each unlock step
    uint256 _vestingStartDate  // unix timestamp of TGE
)
```

Reverts: `ZeroAddress()` (`_token` or `_admin`), `"TGE percent exceeds 100"`, `"Interval must be > 0"`, `"Duration < interval"`.

**Important: these five parameters are global to the whole contract, not per-beneficiary.** Every investor allocated through this `VestingContract` shares the identical TGE%, cliff, duration, interval, and start date; only the allocation *amount* varies per person (set via `setAllocations`). This was reviewed and confirmed with the client on 2026-07-10. If a project needs different vesting terms for different investor groups (e.g. advisors vs public investors), deploy a **separate `VestingContract`** for each group.

## Functions

| Function | Access | Description |
|---|---|---|
| `setAllocations(address[] users, uint256[] amounts)` | `ADMIN_ROLE`, before `lockAllocations()` | Batch-sets/overwrites each user's total allocation. Computes their TGE amount (`amount * tgePercent / 100`) and schedule (`cliffEnd`, `vestingStart`, `vestingEnd`) from the contract's global parameters. Reverts on length mismatch, zero address, or zero amount. |
| `lockAllocations()` | `ADMIN_ROLE` | Permanently disables further `setAllocations` calls. One-way. |
| `pauseVesting()` / `unpauseVesting()` | `ADMIN_ROLE` | Emergency stop/resume on `claim()`. |
| `claim()` | anyone with an allocation, not paused | Transfers all currently-unlocked, unclaimed tokens to the caller. Reverts if vesting hasn't started (`VestingNotStarted`) or nothing is claimable (`NothingToClaim`). |
| `claimableAmount(address user)` | view | Unlocked-but-not-yet-claimed amount right now. |
| `vestedAmount(address user)` | view | Total unlocked to date, including already-claimed tokens. |
| `getVestingSchedule(address user)` | view | Full `VestingSchedule` struct for one user. |

## Vesting math

```
                    TGE                cliff ends            fully vested
                     │                      │                      │
   ──────────────────┼──────────────────────┼──────────────────────┼──────→ time
                      │                      │← linear release →   │
   before: 0%      TGE% unlocks         nothing more            100%
                   immediately          until cliff ends       unlocked
```

- **At `vestingStartDate`**: `tgePercent` of the allocation unlocks immediately.
- **During the cliff** (`vestingStartDate` → `vestingStartDate + cliffDuration`): nothing more unlocks, no matter how much time passes.
- **After the cliff**, the remaining `100% - tgePercent` unlocks linearly, in discrete steps every `vestingInterval` seconds, until `vestingDuration` has fully elapsed.
- `claim()` can be called any number of times: it always transfers whatever has newly unlocked since the last claim.

## Events

| Event | Fired by | Fields |
|---|---|---|
| `AllocationSet(beneficiary, totalAllocation)` | `setAllocations`, once per user in the batch | |
| `AllocationsLocked(timestamp)` | `lockAllocations` | |
| `TokensClaimed(beneficiary, amount, timestamp)` | `claim` | |

Note: `pauseVesting()`/`unpauseVesting()` do not emit custom events: they rely on OpenZeppelin's built-in `Paused(account)`/`Unpaused(account)` events from the `Pausable` base contract, unlike `ProjectSale`'s pause functions which emit both. This is a minor styling inconsistency, not a functional gap (the events still fire, just under OZ's generic names).

## Example usage

```js
const vesting = await ethers.getContractAt("VestingContract", vestingAddress);

// admin, after the sale finalizes: compute allocations off-chain from
// ProjectSale.getUserContribution(user) / tokenPrice
await vesting.setAllocations(
  [investor1, investor2],
  [ethers.parseUnits("1200", 18), ethers.parseUnits("800", 18)]
);
await vesting.lockAllocations(); // optional, once all allocations are final

// investor, any time after vestingStartDate
await vesting.claim();
```
