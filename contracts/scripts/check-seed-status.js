// contracts/scripts/check-seed-status.js
// READ‑ONLY script – prints on‑chain batch info from seed-output.json

require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

async function main() {
  const seedPath = path.join(__dirname, '..', '..', 'seed-output.json');
  if (!fs.existsSync(seedPath)) {
    console.log('No seed data found. Run: npm run seed --workspace=contracts -- --network mst');
    return;
  }
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const contractInfo = require(path.join(__dirname, '..', '..', 'backend', 'src', 'contract', 'contract.json'));
  const provider = new ethers.JsonRpcProvider(process.env.MST_RPC_URL);
  const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, provider);

  const batches = seed.batches || {};
  if (Object.keys(batches).length === 0) {
    console.log('No seed data found. Run: npm run seed --workspace=contracts -- --network mst');
    return;
  }

  for (const [label, info] of Object.entries(batches)) {
    const batchId = info.batchId;
    const batch = await contract.getBatch(batchId);
    const expiry = new Date(Number(batch.expiryDate) * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const holder = batch.currentHolder;
    const status = batch.status === 0 ? 'Active' : 'Recalled';
    console.log(`Batch ${label}:`);
    console.log(`  ID: ${batchId}`);
    console.log(`  Holder: ${holder}`);
    console.log(`  Status: ${status}`);
    console.log(`  Expiry (IST): ${expiry}`);
  }
}

main().catch(err => {
  console.error('Error:', err);
});
