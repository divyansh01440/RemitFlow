require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const POLYGON_RPC_URL      = process.env.POLYGON_RPC_URL      || "https://polygon-rpc.com";
const POLYGON_AMOY_RPC_URL = process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const POLYGONSCAN_API_KEY  = process.env.POLYGONSCAN_API_KEY  || "dummy";

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
      {
        version: "0.8.20",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  networks: {
    hardhat:   { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
    amoy: {
      url:      POLYGON_AMOY_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId:  80002,
    },
    polygon: {
      url:      POLYGON_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId:  137,
    },
  },
  etherscan: {
    apiKey: {
      polygon:     POLYGONSCAN_API_KEY,
      polygonAmoy: POLYGONSCAN_API_KEY,
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL:     "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
  gasReporter: { enabled: true, currency: "USD" },
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};