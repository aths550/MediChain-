require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const MST_RPC_URL = process.env.MST_RPC_URL || "https://testnetrpc.mstblockchain.com";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      // "paris" evmVersion avoids PUSH0 opcode (EIP-3855, Shanghai+)
      // Many alt-EVM chains (including MST testnet) don't support PUSH0 yet
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    mst: {
      url: MST_RPC_URL,
      chainId: 91562037,
      accounts: [PRIVATE_KEY],
      timeout: 120000, // 2 min — alt-EVM chains can be slow
      gasPrice: "auto",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
