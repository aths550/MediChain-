/**
 * seed.js — Demo data seeding script.
 *
 * Creates 4 demo batches and funds role accounts from the deployer.
 *
 * IMPORTANT: The deployer is the ONLY account you need to fund from the faucet.
 * This script sends small MSTC amounts to the role accounts automatically.
 *
 * Run: npx hardhat run scripts/seed.js --network mst
 *
 * Accounts created from deterministic mnemonics (from .env SEED_PHRASE_* or
 * a fixed demo mnemonic). Their private keys are printed at the end for
 * import into MetaMask.
 *
 * 4 Demo Batches:
 *   1. Amoxicillin 500mg   — full journey mfg→dist→pharmacy → VERIFIED
 *   2. Azithromycin 250mg  — expiry 5 min after seeding, at pharmacy → flips EXPIRED
 *   3. Paracetamol 650mg   — at pharmacy, recalled live during demo → RECALLED
 *   4. Metformin 500mg     — stuck at distributor → IN_TRANSIT
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const EXPLORER_BASE = "https://testnet.mstscan.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const QR_SECRET    = process.env.QR_SECRET || "change_me_in_production";

// Minimum deployer balance required (in MSTC) to fund accounts and deploy
const MIN_DEPLOYER_BALANCE = ethers.parseEther("0.5");

// Amount to send to each demo role account
const FUND_AMOUNT = ethers.parseEther("0.05");

// ─── Demo wallets (from a fixed mnemonic so they're reproducible) ─────────────
// WARNING: These are for TESTNET DEMO ONLY. Never use on mainnet.
const DEMO_MNEMONIC =
  "test test test test test test test test test test test junk";

function getDemoWallet(index) {
  const path = `m/44'/60'/0'/0/${index}`;
  return ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(DEMO_MNEMONIC),
    path
  );
}

// ─── HMAC helper (same as backend) ───────────────────────────────────────────

function computeHmac(batchId, serial) {
  return crypto
    .createHmac("sha256", QR_SECRET)
    .update(`${batchId}:${serial}`)
    .digest("hex");
}

function buildQrUrl(batchId, serial) {
  const sig = computeHmac(batchId, serial);
  return `${FRONTEND_URL}/verify/${batchId}?s=${encodeURIComponent(serial)}&sig=${sig}`;
}

function generateSerial(batchId, index) {
  const h = crypto
    .createHmac("sha256", QR_SECRET)
    .update(`${batchId}-unit-${index}`)
    .digest("hex");
  return `${h.slice(0, 6).toUpperCase()}-${String(index).padStart(6, "0")}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBatchId(label) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

async function fund(deployer, to, label) {
  console.log(`  💸 Funding ${label} (${to.address})…`);
  const tx = await deployer.sendTransaction({ to: to.address, value: FUND_AMOUNT });
  await tx.wait();
  console.log(`     ✓ Sent ${ethers.formatEther(FUND_AMOUNT)} MSTC → ${to.address}`);
}

async function grantRoleAndFund(deployer, medichain, role, wallet, label) {
  // Connect wallet to provider so it can sign
  const connected = wallet.connect(ethers.provider);

  // Grant role (deployer is admin)
  console.log(`  🔑 Granting ${label} role to ${wallet.address}`);
  const tx = await medichain.connect(deployer).grantRole(role, wallet.address);
  await tx.wait();

  // Fund the wallet
  await fund(deployer, wallet, label);

  return connected;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("━".repeat(70));
  console.log("  MediChain — Seed Script");
  console.log("━".repeat(70));

  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log(`\n🌐 Network  : chainId ${network.chainId}`);
  console.log(`📤 Deployer : ${deployer.address}`);

  // ── Balance check ──────────────────────────────────────────────────────────
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💳 Balance  : ${ethers.formatEther(balance)} MSTC`);

  if (balance < MIN_DEPLOYER_BALANCE) {
    console.error("\n❌ Deployer balance is too low to seed accounts.");
    console.error(
      `   Need at least ${ethers.formatEther(MIN_DEPLOYER_BALANCE)} MSTC.`
    );
    console.error(
      `   Current: ${ethers.formatEther(balance)} MSTC.`
    );
    console.error(
      "\n   Fund the deployer at: https://faucet.mstblockchain.com/"
    );
    process.exit(1);
  }

  // ── Load contract ──────────────────────────────────────────────────────────
  const contractJson = require(
    path.join(__dirname, "..", "..", "backend", "src", "contract", "contract.json")
  );
  const medichain = await ethers.getContractAt("MediChain", contractJson.address, deployer);
  console.log(`\n📄 Contract : ${contractJson.address}`);

  // ── Create demo wallets ────────────────────────────────────────────────────
  const mfgWallet  = getDemoWallet(1);
  const distWallet = getDemoWallet(2);
  const pharWallet = getDemoWallet(3);
  const regWallet  = getDemoWallet(4);

  console.log("\n👤 Demo Accounts (TESTNET ONLY — DO NOT USE ON MAINNET):");
  console.log(`   Manufacturer  : ${mfgWallet.address}`);
  console.log(`   Distributor   : ${distWallet.address}`);
  console.log(`   Pharmacy      : ${pharWallet.address}`);
  console.log(`   Regulator     : ${regWallet.address}`);

  // ── Grant roles and fund ───────────────────────────────────────────────────
  console.log("\n🔑 Granting roles and funding accounts…");

  const MANUFACTURER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANUFACTURER_ROLE"));
  const DISTRIBUTOR_ROLE  = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));
  const PHARMACY_ROLE     = ethers.keccak256(ethers.toUtf8Bytes("PHARMACY_ROLE"));
  const REGULATOR_ROLE    = ethers.keccak256(ethers.toUtf8Bytes("REGULATOR_ROLE"));

  const mfg  = await grantRoleAndFund(deployer, medichain, MANUFACTURER_ROLE, mfgWallet, "Manufacturer");
  const dist = await grantRoleAndFund(deployer, medichain, DISTRIBUTOR_ROLE,  distWallet, "Distributor");
  const phar = await grantRoleAndFund(deployer, medichain, PHARMACY_ROLE,     pharWallet, "Pharmacy");
  const reg  = await grantRoleAndFund(deployer, medichain, REGULATOR_ROLE,    regWallet,  "Regulator");

  const nowTs = BigInt(Math.floor(Date.now() / 1000));
  const YEAR  = 365n * 24n * 3600n;
  const FIVE_MINUTES = 5n * 60n;

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH 1: Amoxicillin — full journey → VERIFIED
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n━".repeat(40));
  console.log("📦 Batch 1: Amoxicillin 500mg (→ VERIFIED)");

  const amoxId = makeBatchId("AMOX-DEMO-001");
  const amoxExpiry = nowTs + YEAR;

  let tx = await medichain.connect(mfg).registerBatch(
    amoxId, "Amoxicillin 500mg", "PharmaCo Ltd",
    nowTs - 86400n, amoxExpiry, 1000n,
    ethers.keccak256(ethers.toUtf8Bytes("amox-lab-cert-2024"))
  );
  await tx.wait();
  console.log(`  ✓ Registered. BatchId: ${amoxId.slice(0, 16)}…`);

  tx = await medichain.connect(mfg).transferBatch(amoxId, dist.address, "Shipped to distributor");
  await tx.wait();
  console.log(`  ✓ mfg → distributor`);

  tx = await medichain.connect(dist).transferBatch(amoxId, phar.address, "Delivered to Pune Pharmacy");
  await tx.wait();
  console.log(`  ✓ distributor → pharmacy`);

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH 2: Azithromycin — expires in 5 minutes → EXPIRED (live flip)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n━".repeat(40));
  console.log("📦 Batch 2: Azithromycin 250mg (→ EXPIRED in ~5 min)");

  const azithId = makeBatchId("AZITH-DEMO-001");
  // expiryDate must be > block.timestamp; we set it to +5 minutes
  // The contract checks expiryDate > block.timestamp at registration time
  const azithExpiry = nowTs + FIVE_MINUTES + 30n; // small buffer for tx confirmation time

  tx = await medichain.connect(mfg).registerBatch(
    azithId, "Azithromycin 250mg", "MedLife Pharma",
    nowTs - 7200n, azithExpiry, 500n,
    ethers.keccak256(ethers.toUtf8Bytes("azith-lab-cert-2024"))
  );
  await tx.wait();
  console.log(`  ✓ Registered. Expiry: ${new Date(Number(azithExpiry) * 1000).toISOString()}`);

  tx = await medichain.connect(mfg).transferBatch(azithId, dist.address, "Rush delivery");
  await tx.wait();
  console.log(`  ✓ mfg → distributor`);

  tx = await medichain.connect(dist).transferBatch(azithId, phar.address, "Received at pharmacy");
  await tx.wait();
  console.log(`  ✓ distributor → pharmacy`);

  const expiryTimeStr = new Date(Number(azithExpiry) * 1000).toLocaleTimeString("en-IN");
  console.log(`\n  ⏰ This batch EXPIRES at ${expiryTimeStr} (local time).`);
  console.log("     Scan before then: VERIFIED. Scan after: EXPIRED.");

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH 3: Paracetamol — at pharmacy, will be recalled live → RECALLED
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n━".repeat(40));
  console.log("📦 Batch 3: Paracetamol 650mg (→ RECALLED during demo)");

  const paraId = makeBatchId("PARA-DEMO-001");
  const paraExpiry = nowTs + YEAR;

  tx = await medichain.connect(mfg).registerBatch(
    paraId, "Paracetamol 650mg", "HealWell Pharmaceuticals",
    nowTs - 3n * 86400n, paraExpiry, 2000n,
    ethers.keccak256(ethers.toUtf8Bytes("para-lab-cert-2024"))
  );
  await tx.wait();
  console.log(`  ✓ Registered`);

  tx = await medichain.connect(mfg).transferBatch(paraId, dist.address, "To distributor");
  await tx.wait();
  tx = await medichain.connect(dist).transferBatch(paraId, phar.address, "To pharmacy");
  await tx.wait();
  console.log(`  ✓ At pharmacy — ready to scan as VERIFIED`);
  console.log("  📋 During demo: recall it from Dashboard using lot PARA-DEMO-001");

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH 4: Metformin — stuck at distributor → IN_TRANSIT
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n━".repeat(40));
  console.log("📦 Batch 4: Metformin 500mg (→ IN TRANSIT)");

  const metId = makeBatchId("MET-DEMO-001");
  const metExpiry = nowTs + YEAR;

  tx = await medichain.connect(mfg).registerBatch(
    metId, "Metformin 500mg", "DiabeCare Pharma",
    nowTs - 86400n, metExpiry, 1500n,
    ethers.keccak256(ethers.toUtf8Bytes("met-lab-cert-2024"))
  );
  await tx.wait();
  console.log(`  ✓ Registered`);

  tx = await medichain.connect(mfg).transferBatch(metId, dist.address, "Sent to distributor");
  await tx.wait();
  console.log(`  ✓ At distributor — will show IN TRANSIT`);

  // ══════════════════════════════════════════════════════════════════════════
  // Generate QR codes and save them
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n━".repeat(40));
  console.log("🔲 Generating QR code URLs…");

  const batches = [
    { id: amoxId,  label: "AMOX-DEMO-001",  drug: "Amoxicillin 500mg",  result: "VERIFIED" },
    { id: azithId, label: "AZITH-DEMO-001", drug: "Azithromycin 250mg", result: "EXPIRED (timed)" },
    { id: paraId,  label: "PARA-DEMO-001",  drug: "Paracetamol 650mg",  result: "RECALLED (live)" },
    { id: metId,   label: "MET-DEMO-001",   drug: "Metformin 500mg",    result: "IN_TRANSIT" },
  ];

  const demoQrs = batches.map(({ id, label, drug, result }) => {
    const serial = generateSerial(id, 1);
    const url    = buildQrUrl(id, serial);
    console.log(`\n  ${drug}`);
    console.log(`    BatchId : ${id}`);
    console.log(`    Serial  : ${serial}`);
    console.log(`    QR URL  : ${url}`);
    console.log(`    Expected: ${result}`);
    return { label, drug, batchId: id, serial, url, expectedResult: result };
  });

  // Write seed output to a JSON file for reference
  const seedOutput = {
    seededAt: new Date().toISOString(),
    network:  network.chainId.toString(),
    contract: contractJson.address,
    accounts: {
      manufacturer: { address: mfgWallet.address, privateKey: mfgWallet.privateKey },
      distributor:  { address: distWallet.address, privateKey: distWallet.privateKey },
      pharmacy:     { address: pharWallet.address, privateKey: pharWallet.privateKey },
      regulator:    { address: regWallet.address, privateKey: regWallet.privateKey },
    },
    batches: {
      amoxicillin:   { batchId: amoxId,  lotNumber: "AMOX-DEMO-001",  expiryDate: Number(amoxExpiry) },
      azithromycin:  { batchId: azithId, lotNumber: "AZITH-DEMO-001", expiryDate: Number(azithExpiry) },
      paracetamol:   { batchId: paraId,  lotNumber: "PARA-DEMO-001",  expiryDate: Number(paraExpiry) },
      metformin:     { batchId: metId,   lotNumber: "MET-DEMO-001",   expiryDate: Number(metExpiry) },
    },
    demoQrs,
    frontendUrl: FRONTEND_URL,
  };

  // Write to project root (GITIGNORED — contains private keys)
  const outPath = path.join(__dirname, "..", "..", "seed-output.json");
  fs.writeFileSync(outPath, JSON.stringify(seedOutput, null, 2));

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + "━".repeat(70));
  console.log("  ✅ Seeding complete!");
  console.log("━".repeat(70));
   // Private keys omitted for security
  console.log("\n🌐 Explorer links:");
  batches.forEach(({ id, drug }) => {
    // No contract address link — the batchId is an indexed param
    console.log(`   ${drug}: ${EXPLORER_BASE}/address/${contractJson.address}`);
  });
  console.log("\n⚠  IMPORTANT: seed-output.json contains private keys.");
  console.log("   It is gitignored. Do NOT share it.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
