const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");
const readline = require("readline");

/**
 * Deploys SpringboardFactory to BSC mainnet. Same production pattern as
 * scripts/deploySpringboardFactory.js, but the private key is typed in at
 * runtime (masked, never written to .env/disk/logs) instead of being read
 * from the environment, so a one-off deployer doesn't need to handle a
 * .env file at all.
 *
 * Usage:
 *   npx hardhat run scripts/deployMainnetFactory.js --network bsc
 *
 * See docs/MAINNET_DEPLOY_GUIDE.html for the full walkthrough.
 */

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const output = rl._writeToOutput;
    rl._writeToOutput = function (text) {
      if (text.trim() === question.trim() || text.includes("\n")) {
        output.call(rl, text);
      } else {
        output.call(rl, "*".repeat(text.length));
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("=== SpringboardFactory Mainnet Deployment (BSC) ===");
  console.log("Network:", hre.network.name);
  console.log("RPC:", hre.network.config.url);
  console.log("");

  const privateKey = await askHidden("Paste your deployer wallet's private key: ");
  if (!privateKey) {
    throw new Error("No private key entered.");
  }

  const deployer = new ethers.Wallet(
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`,
    ethers.provider
  );

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("");
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "BNB");
  console.log("");

  if (balance === 0n) {
    throw new Error("Deployer has 0 BNB. Fund this address with BNB for gas before deploying.");
  }

  const proceed = await ask("This will deploy to BSC MAINNET using real funds. Continue? (yes/no): ");
  if (proceed.toLowerCase() !== "yes") {
    console.log("Aborted.");
    return;
  }

  const adminInput = await ask(
    `Factory admin address (press Enter to use the deployer address ${deployer.address}): `
  );
  const adminAddress = adminInput || deployer.address;

  console.log("");
  console.log("Factory admin:", adminAddress);
  console.log("");

  const Factory = await ethers.getContractFactory("SpringboardFactory", deployer);
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
  console.log("Next steps:");
  console.log("1. Update deliverables/addresses.json and deliverables/abis/.");
  console.log("2. Check off the relevant item in docs/CHECKLIST.md.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
