require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 97,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY ? [process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    bsc: {
      // No private key here on purpose: scripts/deployMainnetFactory.js prompts
      // for it interactively instead of reading it from .env.
      url: process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed.binance.org/",
      accounts: [],
      chainId: 56,
    },
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY || "",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
