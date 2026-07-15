# ProjectSale

`contracts/ProjectSale.sol`

Handles one project's fundraising: contributions, caps, whitelist enforcement, refunds, and finalization. One deployed per project, always via `SpringboardFactory.createSale()`: see [SPRINGBOARD_FACTORY.md](./SPRINGBOARD_FACTORY.md).

## Roles

| Role | Granted to | Can do |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` / `ADMIN_ROLE` | whoever called `createSale` on the Factory | `finalizeSale`, `pauseSale`, `unpauseSale`, `setWhitelistRoot` |
| `MULTISIG_ROLE` | nobody by default: must be granted explicitly | `emergencyWithdraw` only |

`ADMIN_ROLE` **cannot** call `emergencyWithdraw`: that's deliberate. See [SECURITY.md](./SECURITY.md).

## Constructor and immutable config

All sale parameters are set once, at deployment, via a `SaleParams` struct, and stored as Solidity `immutable` variables. **Nothing here can ever change after deployment**: not by the admin, not by anyone:

| Field | Notes |
|---|---|
| `projectId` | |
| `tokenAddress` | the project's own token (for reference: not transferred by this contract) |
| `paymentToken` | stablecoin accepted for contributions (real USDC/USDT on mainnet) |
| `treasury` | receives all funds on `finalizeSale`; must be a multisig on mainnet |
| `startTime` / `endTime` | sale window (unix timestamps) |
| `softCap` / `hardCap` | minimum raise for success / absolute contribution ceiling |
| `minContribution` / `maxContribution` | per-wallet limits (cumulative across multiple `contribute()` calls) |
| `tokenPrice` | used off-chain to compute token allocations for vesting |
| `totalAllocation` | total project tokens allocated to this sale |
| `vestingContract` | address only: never called by this contract |
| `refundEnabled` | whether `claimRefund()` is usable if soft cap is missed |
| `whitelistRequired` | whether `contribute()` enforces the Merkle whitelist |

Reverts on deployment: `ZeroAddress()` (any of `tokenAddress`/`paymentToken`/`treasury`/`admin`), `InvalidTimeRange()` (`startTime >= endTime`), `InvalidCaps()` (`softCap > hardCap` or `minContribution > maxContribution`).

## Sale lifecycle

```
Pending  →  Active  →  Ended  →  Finalized
(before      (during      (after      (admin called
 startTime)   window)      endTime)    finalizeSale)
```
Query the current state via `getSaleStatus()`.

## Functions

| Function | Access | Description |
|---|---|---|
| `contribute(uint256 amount, bytes32[] merkleProof)` | anyone, sale must be `Active` and not paused | Transfers `amount` of `paymentToken` from caller. Reverts if outside the time window (`SaleNotActive`), zero amount (`ZeroAmount`), would exceed `hardCap` (`HardCapExceeded`), fails whitelist check (`NotWhitelisted`), or pushes the caller's cumulative contribution outside `[minContribution, maxContribution]` (`ContributionOutOfRange`). |
| `claimRefund()` | anyone with a contribution, after `endTime`, only if `refundEnabled` and `totalRaised < softCap` | Returns the caller's full contribution. Reverts on double-claim (`AlreadyRefunded`) or zero contribution (`NoContribution`). |
| `finalizeSale()` | `ADMIN_ROLE`, after `endTime`, only if `totalRaised >= softCap` | Sends `totalRaised` to `treasury`. One-time only (`SaleAlreadyFinalized` on retry). |
| `pauseSale()` / `unpauseSale()` | `ADMIN_ROLE` | Emergency stop/resume on `contribute()`. Does not affect refunds or finalization. |
| `setWhitelistRoot(bytes32 merkleRoot)` | `ADMIN_ROLE` | Updates the Merkle root used by `contribute()`'s whitelist check. |
| `getUserContribution(address user)` | view | Cumulative contribution for one wallet. |
| `getSaleStatus()` | view | Returns `(raised, participants, status)`: status is `0=Pending, 1=Active, 2=Ended, 3=Finalized`. |
| `emergencyWithdraw()` | `MULTISIG_ROLE` only | Sweeps any stuck `paymentToken` balance to `treasury`: nowhere else. Reverts on zero balance. |

## Events

| Event | Fired by |
|---|---|
| `ContributionReceived(user, amount, timestamp)` | `contribute` |
| `SaleFinalized(totalRaised, totalParticipants, timestamp)` | `finalizeSale` |
| `RefundClaimed(user, amount, timestamp)` | `claimRefund` |
| `SalePaused(admin, timestamp)` / `SaleUnpaused(admin, timestamp)` | `pauseSale` / `unpauseSale` |
| `WhitelistRootUpdated(oldRoot, newRoot, timestamp)` | `setWhitelistRoot` |
| `EmergencyWithdraw(by, amount, timestamp)` | `emergencyWithdraw` |

## Whitelist and Merkle proofs

`contribute()` takes a `bytes32[] merkleProof` parameter **even when `whitelistRequired` is `false`**: pass `[]` in that case. This differs slightly from the original spec's abbreviated `contribute(amount)` signature; the extra parameter is required to support the whitelist feature also listed in the spec.

The contract only ever stores a single 32-byte Merkle **root** on-chain (via `setWhitelistRoot`): it never sees or stores the full address list. Generating and supplying proofs is entirely the backend's responsibility:

1. **Build the tree off-chain**, from the full list of approved addresses, using the same library already used in this repo's tests:
   ```js
   const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
   const tree = StandardMerkleTree.of(
     whitelistedAddresses.map((addr) => [addr]),
     ["address"]
   );
   ```
2. **Publish only the root**:
   ```js
   await sale.setWhitelistRoot(tree.root);
   ```
3. **Keep the full tree** in your own backend/database: it cannot be regenerated from on-chain data alone.
4. **When a specific user wants to contribute**, look up their proof and hand it to the frontend:
   ```js
   for (const [i, v] of tree.entries()) {
     if (v[0] === userAddress) {
       const proof = tree.getProof(i);
       // return `proof` to the frontend
     }
   }
   ```
5. **The frontend calls** `sale.contribute(amount, proof)` with that proof. The contract verifies it against the stored root via OpenZeppelin's `MerkleProof.verify`.

A full working example of this exact flow (build → root → proof → verify) is in `test/ProjectSale.test.js`, under the "Whitelist enforcement" test block.

## Example usage

```js
const sale = await ethers.getContractAt("ProjectSale", saleAddress);

// no whitelist required
await paymentToken.approve(saleAddress, amount);
await sale.contribute(amount, []);

// whitelist required: proof from backend, see above
await sale.contribute(amount, proof);

// after sale ends
await sale.finalizeSale();          // if soft cap met
// or
await sale.claimRefund();           // if soft cap missed, per contributor
```
