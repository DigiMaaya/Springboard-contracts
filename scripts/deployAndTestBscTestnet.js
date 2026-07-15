const hre = require("hardhat");
const { ethers } = hre;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(targetTimestamp, label) {
  while (true) {
    const block = await ethers.provider.getBlock("latest");
    if (block.timestamp >= targetTimestamp) {
      console.log(`  reached ${label} (chain time ${block.timestamp} >= ${targetTimestamp})`);
      return;
    }
    const remaining = targetTimestamp - block.timestamp;
    console.log(`  waiting for ${label}... ${remaining}s remaining`);
    await sleep(Math.min(remaining, 15) * 1000);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Springboard Launchpad — BSC Testnet Deployment + E2E Test ===");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "tBNB");
  console.log("");

  const addresses = {};

  // ─────────────────────────────────────────────
  // 1. Deploy mock tokens (stand-ins for USDC and the project token)
  // ─────────────────────────────────────────────
  console.log("[1/8] Deploying mock payment token (USDC) and project token...");
  const ERC20Mock = await ethers.getContractFactory("ERC20Mock");

  const paymentToken = await ERC20Mock.deploy("Mock USDC", "mUSDC", ethers.parseUnits("1000000", 18));
  await paymentToken.waitForDeployment();
  addresses.paymentToken = await paymentToken.getAddress();
  console.log("  paymentToken (mUSDC):", addresses.paymentToken);

  const projectToken = await ERC20Mock.deploy("Mock Project Token", "mPRJ", ethers.parseUnits("1000000", 18));
  await projectToken.waitForDeployment();
  addresses.projectToken = await projectToken.getAddress();
  console.log("  projectToken (mPRJ):", addresses.projectToken);
  console.log("");

  // ─────────────────────────────────────────────
  // 2. Compute sale + vesting timing (short windows for live testnet testing)
  // ─────────────────────────────────────────────
  const latestBlock = await ethers.provider.getBlock("latest");
  const now = latestBlock.timestamp;

  const startTime = now + 90; // sale starts in 90s
  const endTime = startTime + 180; // sale runs for 3 minutes
  const cliffDuration = 60; // 1 minute cliff
  const vestingDuration = 180; // 3 minute linear vest
  const vestingInterval = 60; // unlocks every 1 minute
  const vestingStartDate = endTime + 30; // TGE 30s after sale ends

  console.log("[2/8] Sale/vesting timing computed:");
  console.log("  now:", now);
  console.log("  sale startTime:", startTime, `(+${startTime - now}s)`);
  console.log("  sale endTime:", endTime, `(+${endTime - now}s)`);
  console.log("  vesting TGE date:", vestingStartDate, `(+${vestingStartDate - now}s)`);
  console.log("");

  // ─────────────────────────────────────────────
  // 3. Deploy VestingContract
  // ─────────────────────────────────────────────
  console.log("[3/8] Deploying VestingContract...");
  const TGE_PERCENT = 10;
  const Vesting = await ethers.getContractFactory("VestingContract");
  const vesting = await Vesting.deploy(
    addresses.projectToken,
    deployer.address,
    TGE_PERCENT,
    cliffDuration,
    vestingDuration,
    vestingInterval,
    vestingStartDate
  );
  await vesting.waitForDeployment();
  addresses.vesting = await vesting.getAddress();
  console.log("  VestingContract:", addresses.vesting);

  const vestingFunding = ethers.parseUnits("10000", 18);
  await (await projectToken.transfer(addresses.vesting, vestingFunding)).wait();
  console.log("  Funded vesting contract with", ethers.formatEther(vestingFunding), "mPRJ");
  console.log("");

  // ─────────────────────────────────────────────
  // 4. Deploy SpringboardFactory
  // ─────────────────────────────────────────────
  console.log("[4/8] Deploying SpringboardFactory...");
  const Factory = await ethers.getContractFactory("SpringboardFactory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  addresses.factory = await factory.getAddress();
  console.log("  SpringboardFactory:", addresses.factory);
  console.log("");

  // ─────────────────────────────────────────────
  // 5. Create a ProjectSale via the factory
  // ─────────────────────────────────────────────
  console.log("[5/8] Creating sale via factory.createSale()...");
  const softCap = ethers.parseUnits("50", 18);
  const hardCap = ethers.parseUnits("500", 18);
  const minContribution = ethers.parseUnits("1", 18);
  const maxContribution = ethers.parseUnits("200", 18);
  const tokenPrice = ethers.parseUnits("0.5", 18);
  const totalAllocation = ethers.parseUnits("1000", 18);

  const saleParams = {
    projectId: 1,
    tokenAddress: addresses.projectToken,
    paymentToken: addresses.paymentToken,
    treasury: deployer.address, // single-signer testnet run; production must use a multisig (see HANDOFF.md)
    startTime,
    endTime,
    softCap,
    hardCap,
    minContribution,
    maxContribution,
    tokenPrice,
    totalAllocation,
    vestingContract: addresses.vesting,
    refundEnabled: true,
    whitelistRequired: false,
  };

  const createTx = await factory.createSale(saleParams);
  await createTx.wait();
  addresses.sale = await factory.getSale(1);
  console.log("  ProjectSale deployed at:", addresses.sale);
  console.log("  tx:", createTx.hash);
  console.log("");

  const sale = await ethers.getContractAt("ProjectSale", addresses.sale);

  // ─────────────────────────────────────────────
  // 6. Contribute during the sale window
  // ─────────────────────────────────────────────
  console.log("[6/8] Waiting for sale to start, then contributing...");
  await waitUntil(startTime, "sale start");

  const contributionAmount = ethers.parseUnits("60", 18); // above soft cap
  await (await paymentToken.approve(addresses.sale, contributionAmount)).wait();
  const contributeTx = await sale.contribute(contributionAmount, []);
  await contributeTx.wait();
  console.log("  Contributed", ethers.formatEther(contributionAmount), "mUSDC");
  console.log("  tx:", contributeTx.hash);

  const status = await sale.getSaleStatus();
  console.log("  Sale status -> raised:", ethers.formatEther(status.raised), "participants:", status.participants.toString());
  console.log("");

  // ─────────────────────────────────────────────
  // 7. Finalize sale after it ends
  // ─────────────────────────────────────────────
  console.log("[7/8] Waiting for sale to end, then finalizing...");
  await waitUntil(endTime, "sale end");

  const treasuryBalBefore = await paymentToken.balanceOf(deployer.address);
  const finalizeTx = await sale.finalizeSale();
  await finalizeTx.wait();
  const treasuryBalAfter = await paymentToken.balanceOf(deployer.address);
  console.log("  Sale finalized. tx:", finalizeTx.hash);
  console.log("  Treasury balance delta:", ethers.formatEther(treasuryBalAfter - treasuryBalBefore + contributionAmount), "(net of self-contribution round-trip)");
  console.log("  finalized:", await sale.finalized());
  console.log("");

  // ─────────────────────────────────────────────
  // 8. Set vesting allocation and claim TGE
  // ─────────────────────────────────────────────
  console.log("[8/8] Setting vesting allocation and claiming TGE...");
  const contribution = await sale.getUserContribution(deployer.address);
  const allocation = (contribution * ethers.parseUnits("1", 18)) / tokenPrice;

  const setAllocTx = await vesting.setAllocations([deployer.address], [allocation]);
  await setAllocTx.wait();
  console.log("  Allocation set:", ethers.formatEther(allocation), "mPRJ. tx:", setAllocTx.hash);

  await waitUntil(vestingStartDate, "vesting TGE date");

  const balBeforeClaim = await projectToken.balanceOf(deployer.address);
  const claimTx = await vesting.claim();
  await claimTx.wait();
  const balAfterClaim = await projectToken.balanceOf(deployer.address);
  console.log("  Claimed:", ethers.formatEther(balAfterClaim - balBeforeClaim), "mPRJ. tx:", claimTx.hash);
  console.log("");

  console.log("=== E2E FLOW COMPLETE ===");
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
