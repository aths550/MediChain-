/**
 * check-network.js
 * Phase 0: Verify MST Chain testnet connectivity.
 *
 * Run: npx hardhat run scripts/check-network.js --network mst
 *
 * Checks:
 *   1. eth_chainId matches expected 91562037
 *   2. Prints latest block number
 *   3. Prints deployer wallet balance
 *
 * If chainId != 91562037, prints an error and exits with code 1.
 * The CI/deploy pipeline should treat a non-zero exit as a hard stop.
 */

const { ethers } = require("hardhat");

const EXPECTED_CHAIN_ID = 91562037n;
const EXPLORER_BASE = "https://testnet.mstscan.com";

async function main() {
  console.log("━".repeat(60));
  console.log("  MediChain — Phase 0: Network Check");
  console.log("━".repeat(60));

  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const chainId = network.chainId;

  console.log(`\n🔌 Connected to: ${network.name || "unknown"}`);
  console.log(`   Chain ID : ${chainId}`);
  console.log(`   Expected : ${EXPECTED_CHAIN_ID}`);

  if (chainId !== EXPECTED_CHAIN_ID) {
    console.error("\n❌ CHAIN ID MISMATCH — STOPPING.");
    console.error(
      `   Got ${chainId}, expected ${EXPECTED_CHAIN_ID} (MST Testnet).`
    );
    console.error(
      "   Check MST_RPC_URL and the network in hardhat.config.js."
    );
    process.exit(1);
  }

  console.log("   ✅ Chain ID matches MST Testnet.\n");

  // Latest block
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  console.log(`📦 Latest block : #${blockNumber}`);
  console.log(
    `   Timestamp   : ${new Date(Number(block.timestamp) * 1000).toISOString()}`
  );
  console.log(
    `   Explorer    : ${EXPLORER_BASE}/block/${blockNumber}\n`
  );

  // Deployer balance
  const [deployer] = await ethers.getSigners();
  const balance = await provider.getBalance(deployer.address);
  const balanceEth = ethers.formatEther(balance);

  console.log(`💳 Deployer address : ${deployer.address}`);
  console.log(`   Balance         : ${balanceEth} MSTC`);

  if (balance === 0n) {
    console.warn("\n⚠️  Deployer balance is 0 MSTC.");
    console.warn(
      "   Fund it at: https://faucet.mstblockchain.com/ before deploying."
    );
  } else {
    console.log("   ✅ Deployer is funded.\n");
  }

  console.log("━".repeat(60));
  console.log("  ✅ Network check PASSED. Safe to proceed.");
  console.log("━".repeat(60));
}

main().catch((err) => {
  console.error("Network check failed:", err.message);
  process.exit(1);
});
