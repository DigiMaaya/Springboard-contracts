const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

/**
 * Clean deployment script — deploys all contracts and registers one sale,
 * but performs NO further activity (no contribute, finalize, refund,
 * setAllocations, or claim calls). Intended as the real deployment pass,
 * separate from the earlier deploy+E2E-test run.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Springboard Launchpad — Deployment ===");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "tBNB");
  console.log("");

  const addresses = {};
  const constructorArgs = {};

  // ─────────────────────────────────────────────
  // 1. Deploy mock payment token and project token
  //    (stand-ins for real USDC/USDT and the project's token on testnet)
  // ─────────────────────────────────────────────
  console.log("[1/4] Deploying mock payment token and project token...");
  const ERC20Mock = await ethers.getContractFactory("ERC20Mock");

  const paymentTokenArgs = ["Mock USDC", "mUSDC", ethers.parseUnits("1000000", 18)];
  const paymentToken = await ERC20Mock.deploy(...paymentTokenArgs);
  await paymentToken.waitForDeployment();
  addresses.paymentToken = await paymentToken.getAddress();
  constructorArgs.paymentToken = paymentTokenArgs;
  console.log("  paymentToken (mUSDC):", addresses.paymentToken);

  const projectTokenArgs = ["Mock Project Token", "mPRJ", ethers.parseUnits("1000000", 18)];
  const projectToken = await ERC20Mock.deploy(...projectTokenArgs);
  await projectToken.waitForDeployment();
  addresses.projectToken = await projectToken.getAddress();
  constructorArgs.projectToken = projectTokenArgs;
  console.log("  projectToken (mPRJ):", addresses.projectToken);
  console.log("");

  // ─────────────────────────────────────────────
  // 2. Deploy VestingContract
  // ─────────────────────────────────────────────
  console.log("[2/4] Deploying VestingContract...");
  const latestBlock = await ethers.provider.getBlock("latest");
  const now = latestBlock.timestamp;

  const TGE_PERCENT = 10;
  const CLIFF_DURATION = 30 * 24 * 3600; // 30 days
  const VESTING_DURATION = 180 * 24 * 3600; // 180 days
  const VESTING_INTERVAL = 30 * 24 * 3600; // 30 days
  const VESTING_START_DATE = now + 30 * 24 * 3600; // TGE 30 days from now

  const vestingArgs = [
    addresses.projectToken,
    deployer.address,
    TGE_PERCENT,
    CLIFF_DURATION,
    VESTING_DURATION,
    VESTING_INTERVAL,
    VESTING_START_DATE,
  ];
  const Vesting = await ethers.getContractFactory("VestingContract");
  const vesting = await Vesting.deploy(...vestingArgs);
  await vesting.waitForDeployment();
  addresses.vesting = await vesting.getAddress();
  constructorArgs.vesting = vestingArgs;
  console.log("  VestingContract:", addresses.vesting);
  console.log("  (not funded, no allocations set — deployment only)");
  console.log("");

  // ─────────────────────────────────────────────
  // 3. Deploy SpringboardFactory
  // ─────────────────────────────────────────────
  console.log("[3/4] Deploying SpringboardFactory...");
  const factoryArgs = [deployer.address];
  const Factory = await ethers.getContractFactory("SpringboardFactory");
  const factory = await Factory.deploy(...factoryArgs);
  await factory.waitForDeployment();
  addresses.factory = await factory.getAddress();
  constructorArgs.factory = factoryArgs;
  console.log("  SpringboardFactory:", addresses.factory);
  console.log("");

  // ─────────────────────────────────────────────
  // 4. Register one ProjectSale via the factory (registration only — no contributions)
  // ─────────────────────────────────────────────
  console.log("[4/4] Creating one ProjectSale via factory.createSale()...");
  const startTime = now + 1 * 24 * 3600; // starts in 1 day
  const endTime = startTime + 7 * 24 * 3600; // runs for 7 days

  const saleParams = {
    projectId: 1,
    tokenAddress: addresses.projectToken,
    paymentToken: addresses.paymentToken,
    treasury: deployer.address, // testnet only — production treasury must be a multisig, see HANDOFF.md
    startTime,
    endTime,
    softCap: ethers.parseUnits("1000", 18),
    hardCap: ethers.parseUnits("5000", 18),
    minContribution: ethers.parseUnits("10", 18),
    maxContribution: ethers.parseUnits("2000", 18),
    tokenPrice: ethers.parseUnits("0.5", 18),
    totalAllocation: ethers.parseUnits("10000", 18),
    vestingContract: addresses.vesting,
    refundEnabled: true,
    whitelistRequired: false,
  };

  const createTx = await factory.createSale(saleParams);
  await createTx.wait();
  addresses.sale = await factory.getSale(1);
  console.log("  ProjectSale deployed at:", addresses.sale);
  console.log("  tx:", createTx.hash);
  console.log("  Sale start:", new Date(startTime * 1000).toISOString());
  console.log("  Sale end:", new Date(endTime * 1000).toISOString());
  console.log("  (no contributions, finalization, or claims performed)");
  console.log("");

  // Fetch the ProjectSale's own constructor args (the SaleParams struct, plus admin) for verification later
  const saleConstructorArgs = {
    ...saleParams,
    admin: deployer.address,
  };

  console.log("=== DEPLOYMENT COMPLETE — NO ACTIVITY PERFORMED ===");
  console.log(JSON.stringify(addresses, null, 2));

  // ─────────────────────────────────────────────
  // Persist deployment record for verification + handoff docs
  // ─────────────────────────────────────────────
  const deploymentRecord = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    addresses,
    constructorArgs: {
      paymentToken: constructorArgs.paymentToken,
      projectToken: constructorArgs.projectToken,
      vesting: constructorArgs.vesting,
      factory: constructorArgs.factory,
      sale: saleConstructorArgs,
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deploymentRecord, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  console.log("");
  console.log("Deployment record written to:", outFile);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
