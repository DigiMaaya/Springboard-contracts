const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");
const readline = require("readline");

/**
 * Deploys SpringboardFactory to BSC mainnet using a mnemonic seed phrase
 * read from .env instead of typing a private key in at runtime. Set:
 *
 *   Phrase=word1 word2 word3 ... word12
 *
 * as a single line, space separated, in .env. The phrase itself is never
 * logged or printed anywhere by this script — only the derived deployer
 * address and balance, which are public on-chain information.
 *
 * Usage:
 *   npx hardhat run scripts/deployMainnetFactoryFromPhrase.js --network bsc
 */

// Piped (non-TTY) stdin hits EOF as soon as it's all flushed, which closes
// readline's Interface even if later questions haven't been asked yet. For
// that case, read all answers up front and consume them one at a time
// instead of relying on readline's live question/answer flow.
const rl = process.stdin.isTTY
  ? readline.createInterface({ input: process.stdin, output: process.stdout })
  : null;
const answerQueue = rl ? null : fs.readFileSync(0, "utf-8").split("\n");

function ask(question) {
  if (rl) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer.trim()));
    });
  }
  const answer = (answerQueue.shift() || "").trim();
  console.log(question + answer);
  return Promise.resolve(answer);
}

async function main() {
  console.log("=== SpringboardFactory Mainnet Deployment (BSC, from .env phrase) ===");
  console.log("Network:", hre.network.name);
  console.log("RPC:", hre.network.config.url);
  console.log("");

  const phrase = process.env.Phrase;
  if (!phrase) {
    throw new Error(
      "Set Phrase in .env as a single line, space separated: Phrase=word1 word2 ... word12"
    );
  }

  const deployer = ethers.Wallet.fromPhrase(phrase.trim(), ethers.provider);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "BNB");
  console.log("");

  if (balance === 0n) {
    throw new Error("Deployer has 0 BNB. Fund this address with BNB for gas before deploying.");
  }

  const proceed = await ask("This will deploy to BSC MAINNET using real funds. Continue? (yes/no): ");
  if (proceed.toLowerCase() !== "yes") {
    console.log("Aborted.");
    if (rl) rl.close();
    return;
  }

  const adminInput = await ask(
    `Factory admin address (press Enter to use the deployer address ${deployer.address}): `
  );
  if (rl) rl.close();
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
