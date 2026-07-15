const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

/**
 * Deploys ONLY SpringboardFactory. This is the real production deployment
 * pattern: the Factory is a platform-level contract, deployed once.
 *
 * Each project's ProjectSale and VestingContract are created later, on
 * demand, as a separate operational step (via factory.createSale() plus an
 * independently deployed VestingContract) whenever an actual project is
 * ready to launch. See docs/ARCHITECTURE.md and docs/DEPLOYMENT.md.
 *
 * Usage:
 *   npx hardhat run scripts/deploySpringboardFactory.js --network <network>
 *
 * Set FACTORY_ADMIN in .env to deploy with a specific admin address
 * (e.g. a multisig on mainnet). Defaults to the deployer's own address,
 * which is only appropriate for testnet.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const adminAddress = process.env.FACTORY_ADMIN || deployer.address;

  console.log("=== SpringboardFactory Deployment ===");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "tBNB/ETH");
  console.log("Factory admin:", adminAddress);
  if (adminAddress === deployer.address) {
    console.log("  WARNING: admin is the deployer's own EOA. Production deployments must use a multisig here: see docs/HANDOFF.md.");
  }
  console.log("");

  const Factory = await ethers.getContractFactory("SpringboardFactory");
  const factory = await Factory.deploy(adminAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("SpringboardFactory deployed at:", factoryAddress);

  const deploymentRecord = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    admin: adminAddress,
    deployedAt: new Date().toISOString(),
    address: factoryAddress,
    constructorArgs: [adminAddress],
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}-factory.json`);
  fs.writeFileSync(outFile, JSON.stringify(deploymentRecord, null, 2));
  console.log("");
  console.log("Deployment record written to:", outFile);
  console.log("");
  console.log("Next: whenever a project is ready to launch, deploy its VestingContract");
  console.log("independently, then call factory.createSale(...) with that address included.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
