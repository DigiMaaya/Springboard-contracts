# Deliverables

Handoff package for the backend team — everything needed to integrate with the deployed contracts, without reading Solidity source.

## Contents

| File | What it is |
|---|---|
| [`addresses.json`](./addresses.json) | Deployed contract addresses (BSC Testnet), with block explorer links and notes on what each address is for |
| [`abis/SpringboardFactory.json`](./abis/SpringboardFactory.json) | ABI for the Factory contract |
| [`abis/ProjectSale.json`](./abis/ProjectSale.json) | ABI for the per-project sale contract |
| [`abis/VestingContract.json`](./abis/VestingContract.json) | ABI for the per-project vesting contract |

## Using these

```js
const { ethers } = require("ethers");
const addresses = require("./deliverables/addresses.json");
const factoryAbi = require("./deliverables/abis/SpringboardFactory.json");

const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC_URL);
const factory = new ethers.Contract(
  addresses.contracts.SpringboardFactory.address,
  factoryAbi,
  provider
);
```

For what each function/event does, see the full docs in [`../docs/`](../docs/) — start with [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Keeping this up to date

If contracts are redeployed or changed, regenerate both files:

```bash
# after running scripts/deploy.js, re-extract ABIs from fresh artifacts:
node -e "
const fs = require('fs');
const contracts = [
  { name: 'SpringboardFactory', artifact: 'artifacts/contracts/SpringboardFactory.sol/SpringboardFactory.json' },
  { name: 'ProjectSale', artifact: 'artifacts/contracts/ProjectSale.sol/ProjectSale.json' },
  { name: 'VestingContract', artifact: 'artifacts/contracts/VestingContract.sol/VestingContract.json' },
];
for (const c of contracts) {
  const data = JSON.parse(fs.readFileSync(c.artifact, 'utf8'));
  fs.writeFileSync('deliverables/abis/' + c.name + '.json', JSON.stringify(data.abi, null, 2));
}
"
```

Then update `addresses.json` manually with the new addresses from `deployments/<network>.json`.
