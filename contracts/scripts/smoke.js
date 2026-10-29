/**
 * smoke.js
 * Phase 0: Deploy a minimal Ping contract to prove the toolchain works.
 *
 * Run: npx hardhat run scripts/smoke.js --network mst
 *
 * Deploys a tiny contract with a single ping() function,
 * calls it, and prints the tx receipt explorer link.
 * If deployment fails with invalid-opcode: the hardhat.config evmVersion
 * is already set to "paris" to prevent PUSH0 issues.
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const EXPLORER_BASE = "https://testnet.mstscan.com";

// Inline the Ping contract so we don't need a separate .sol file for the smoke test
const PING_ABI = [
  "function ping() external pure returns (string memory)",
];
const PING_BYTECODE =
  // Compiled from: pragma solidity ^0.8.20; contract Ping { function ping() external pure returns (string memory) { return "pong"; } }
  // evmVersion: paris
  "0x608060405234801561001057600080fd5b5060c78061001f6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c8063eff3b72114602d575b600080fd5b60336047565b604051603e9190608c565b60405180910390f35b60606040518060400160405280600480526020017f706f6e670000000000000000000000000000000000000000000000000000000081525090565b600060208083528351808285015260005b818110156090578581018301518582016040015282016076565b5060006040828601015260407fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0601f8301168501019250505092915050565b00a164";

async function main() {
  console.log("━".repeat(60));
  console.log("  MediChain — Phase 0: Smoke Test (Ping Contract)");
  console.log("━".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`\n📤 Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance : ${ethers.formatEther(balance)} MSTC`);

  if (balance === 0n) {
    console.error("\n❌ Deployer has 0 MSTC. Fund it first:");
    console.error("   https://faucet.mstblockchain.com/");
    process.exit(1);
  }

  console.log("\n🚀 Deploying Ping contract...");

  // Use the Hardhat-compiled Ping artifact (contracts/Ping.sol must exist)
  // We use ethers ContractFactory with inline ABI/bytecode for the smoke test
  const factory = new ethers.ContractFactory(PING_ABI, PING_BYTECODE, deployer);

  let pingContract;
  try {
    pingContract = await factory.deploy();
    await pingContract.waitForDeployment();
  } catch (err) {
    console.error("\n❌ Deployment failed:", err.message);
    if (err.message.includes("invalid opcode") || err.message.includes("PUSH0")) {
      console.error(
        "   Hint: Make sure evmVersion is set to 'paris' in hardhat.config.js"
      );
    }
    process.exit(1);
  }

  const address = await pingContract.getAddress();
  const deployTx = pingContract.deploymentTransaction();

  console.log(`\n✅ Ping deployed at : ${address}`);
  console.log(
    `   TX hash         : ${deployTx?.hash}`
  );
  console.log(
    `   Explorer        : ${EXPLORER_BASE}/address/${address}`
  );

  // Call ping() to confirm the contract is live
  try {
    const result = await pingContract.ping();
    console.log(`\n🏓 ping() returned  : "${result}"`);
    if (result !== "pong") {
      console.error("   Unexpected response from ping()");
      process.exit(1);
    }
    console.log("   ✅ Call successful.\n");
  } catch (err) {
    console.error("\n❌ ping() call failed:", err.message);
    process.exit(1);
  }

  // Write smoke test result to a file for CI reference
  const smokeResult = {
    pingAddress: address,
    deployTxHash: deployTx?.hash,
    timestamp: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "..", "smoke-result.json");
  fs.writeFileSync(outPath, JSON.stringify(smokeResult, null, 2));
  console.log(`📄 Smoke result written to: ${outPath}`);

  console.log("━".repeat(60));
  console.log("  ✅ Smoke test PASSED. Toolchain is working.");
  console.log("━".repeat(60));
}

main().catch((err) => {
  console.error("Smoke test failed:", err.message);
  process.exit(1);
});
