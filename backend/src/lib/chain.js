/**
 * backend/src/lib/chain.js
 * Ethers.js provider and MediChain contract instance.
 *
 * Reads contract address + ABI from backend/src/contract/contract.json
 * (written by deploy.js). Falls back gracefully if not yet deployed.
 *
 * Also sets up event listeners for BatchTransferred and BatchRecalled
 * to invalidate the in-memory cache in real time.
 */

import { ethers } from "ethers";
import { createRequire } from "module";
import { invalidate } from "./cache.js";

// Use require() to import JSON in ESM context
const require = createRequire(import.meta.url);

const RPC_URL = process.env.MST_RPC_URL || "https://testnetrpc.mstblockchain.com";

let provider;
let contract;

function loadContractInfo() {
  try {
    return require("../contract/contract.json");
  } catch {
    console.warn("[chain] contract.json not found — run deploy.js first");
    return null;
  }
}

export function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

export function getContract() {
  if (contract) return contract;

  const info = loadContractInfo();
  if (!info) return null;

  contract = new ethers.Contract(info.address, info.abi, getProvider());

  // ── Cache invalidation via event listeners ──────────────────────────────────
  // When a BatchTransferred or BatchRecalled event fires, we immediately
  // invalidate the cache for that batchId so the next verify call is fresh.

  contract.on("BatchTransferred", (batchId) => {
    console.log(`[cache] Invalidated on BatchTransferred: ${batchId}`);
    invalidate(batchId);
  });

  contract.on("BatchRecalled", (batchId) => {
    console.log(`[cache] Invalidated on BatchRecalled: ${batchId}`);
    invalidate(batchId);
  });

  return contract;
}

/**
 * Fetch batch data from chain (or return null if batchId is not registered).
 * Uses getContract() — caller should handle null contract.
 */
export async function fetchBatch(batchId) {
  const c = getContract();
  if (!c) return null;

  try {
    const isRegistered = await c.isRegistered(batchId);
    if (!isRegistered) return null;

    const [batch, history] = await Promise.all([
      c.getBatch(batchId),
      c.getHistory(batchId),
    ]);

    return { batch, history };
  } catch (err) {
    console.error("[chain] fetchBatch error:", err.message);
    return null;
  }
}

/**
 * Serialise on-chain batch + history into a plain JSON-safe object.
 * BigInt timestamps and numbers are converted to strings/numbers.
 */
export function serialiseBatch(batch, history) {
  const STAGE_MAP = { 0: "Manufacturer", 1: "Distributor", 2: "Pharmacy" };
  const STATUS_MAP = { 0: "Active", 1: "Recalled" };

  return {
    batchId:           batch.batchId,
    drugName:          batch.drugName,
    manufacturerName:  batch.manufacturerName,
    manufactureDate:   Number(batch.manufactureDate),
    expiryDate:        Number(batch.expiryDate),
    quantity:          Number(batch.quantity),
    docHash:           batch.docHash,
    originalManufacturer: batch.originalManufacturer,
    currentHolder:     batch.currentHolder,
    currentStage:      STAGE_MAP[Number(batch.currentStage)] || "Unknown",
    status:            STATUS_MAP[Number(batch.status)] || "Unknown",
    recallReason:      batch.recallReason,
    history: history.map((h) => ({
      from:      h.from,
      to:        h.to,
      timestamp: Number(h.timestamp),
      note:      h.note,
    })),
  };
}
