const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Network:", hre.network.name);
  console.log("Deployer address:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "tBNB");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
