# SpringboardFactory

`contracts/SpringboardFactory.sol`

The master control contract. Deploys and registers a `ProjectSale` contract for each new project, and tracks the full registry of sales.

## Roles

| Role | Granted to | Can do |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | constructor `_admin` | Everything `ADMIN_ROLE` can do, plus `transferFactoryAdmin` |
| `ADMIN_ROLE` | constructor `_admin` | `createSale`, `pauseFactory`, `unpauseFactory`, `setImplementation` |

Both roles start on the same address (the deployer-specified admin) and should be a **multisig wallet** before mainnet use — see [HANDOFF.md](./HANDOFF.md).

## Constructor

```solidity
constructor(address _admin)
```

Reverts with `ZeroAddress()` if `_admin` is the zero address.

## Functions

| Function | Access | Description |
|---|---|---|
| `createSale(CreateSaleParams params)` | `ADMIN_ROLE`, not paused | Deploys a new `ProjectSale` and registers it under `params.projectId`. Reverts with `SaleAlreadyExists()` if that project ID is already registered. |
| `getSale(uint256 projectId)` | public view | Returns the `ProjectSale` address for a project ID, or `address(0)` if unregistered. |
| `getAllSales()` | public view | Returns every registered sale address, in creation order. |
| `pauseFactory()` | `ADMIN_ROLE` | Stops new `createSale` calls. Does **not** affect sales already deployed. |
| `unpauseFactory()` | `ADMIN_ROLE` | Resumes `createSale`. |
| `setImplementation(address newImplementation)` | `ADMIN_ROLE` | See [Deployment pattern](#deployment-pattern) below — reserved, currently has no effect on deployment. |
| `transferFactoryAdmin(address newAdmin)` | `DEFAULT_ADMIN_ROLE` | Moves both roles to a new address, revokes them from the caller. Reverts with `ZeroAddress()` on a zero target. |

### `CreateSaleParams` struct

```solidity
struct CreateSaleParams {
    uint256 projectId;
    address tokenAddress;
    address paymentToken;
    address treasury;
    uint256 startTime;
    uint256 endTime;
    uint256 softCap;
    uint256 hardCap;
    uint256 minContribution;
    uint256 maxContribution;
    uint256 tokenPrice;
    uint256 totalAllocation;
    address vestingContract;
    bool refundEnabled;
    bool whitelistRequired;
}
```

Every field is forwarded straight into the new `ProjectSale`'s constructor — see [PROJECT_SALE.md](./PROJECT_SALE.md#constructor--immutable-config) for what each one locks in. `vestingContract` must be deployed **before** calling `createSale` (the Factory does not deploy vesting contracts — see [ARCHITECTURE.md](./ARCHITECTURE.md)).

The caller of `createSale` (`msg.sender`) automatically becomes the new sale's `ADMIN_ROLE` holder.

## Events

| Event | Fired by | Fields |
|---|---|---|
| `SaleCreated` | `createSale` | `projectId` (indexed), `saleAddress` (indexed), `tokenAddress` (indexed), `paymentToken`, `timestamp` |
| `FactoryPaused` | `pauseFactory` | `admin` (indexed), `timestamp` |
| `FactoryUnpaused` | `unpauseFactory` | `admin` (indexed), `timestamp` |
| `ImplementationUpdated` | `setImplementation` | `oldImplementation` (indexed), `newImplementation` (indexed), `timestamp` |
| `FactoryAdminTransferred` | `transferFactoryAdmin` | `oldAdmin` (indexed), `newAdmin` (indexed), `timestamp` |

## Deployment pattern

`createSale` deploys a **full, independent `ProjectSale` instance** via `new ProjectSale(params)` — not an EIP-1167 minimal-proxy clone. `setImplementation()` and `ImplementationUpdated` exist (satisfying the literal function/event list from the original spec) but `createSale` never reads the stored `implementation` value — it's a reserved slot for a possible future clone-based upgrade path, not an active feature today.

**Why not clones:** `ProjectSale` uses Solidity `immutable` variables for its entire sale configuration. Immutables are baked directly into a contract's own deployed bytecode at creation time — a minimal proxy clone shares its *implementation* contract's bytecode via `delegatecall`, so every clone would read back the **same** immutable values as the original implementation, not its own. Per-sale config genuinely cannot work with this pattern without switching to an `initialize()` + regular storage design — which would also weaken the "locked at deployment" guarantee immutables currently provide. This trade-off was discussed and confirmed with the client on 2026-07-10.

## Example usage

```js
const factory = await ethers.getContractAt("SpringboardFactory", factoryAddress);

const tx = await factory.createSale({
  projectId: 1,
  tokenAddress: projectTokenAddress,
  paymentToken: usdcAddress,
  treasury: treasuryMultisigAddress,
  startTime: Math.floor(Date.now() / 1000) + 86400,
  endTime: Math.floor(Date.now() / 1000) + 86400 * 8,
  softCap: ethers.parseUnits("100000", 18),
  hardCap: ethers.parseUnits("500000", 18),
  minContribution: ethers.parseUnits("50", 18),
  maxContribution: ethers.parseUnits("10000", 18),
  tokenPrice: ethers.parseUnits("0.1", 18),
  totalAllocation: ethers.parseUnits("5000000", 18),
  vestingContract: vestingContractAddress,
  refundEnabled: true,
  whitelistRequired: true,
});
await tx.wait();

const saleAddress = await factory.getSale(1);
```
