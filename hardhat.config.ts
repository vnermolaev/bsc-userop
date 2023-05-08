import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    localhost: {
      chainId: 1337,
      url: 'http://localhost:8545/',
    },
  },
  paths: {
    sources: "./contracts/core",
    artifacts: "./artifacts"
  }
};

export default config;
