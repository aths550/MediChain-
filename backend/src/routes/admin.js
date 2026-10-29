/**
 * backend/src/routes/admin.js
 * Admin/regulator endpoints.
 *
 * GET /api/recalls          — list all recalled batches (from chain via cache)
 * GET /api/regulator/stats  — aggregate stats for the regulator dashboard
 */

import { Router } from "express";
import { getContract, serialiseBatch } from "../lib/chain.js";
import { getScanStats, getRecentSuspicious } from "../db/schema.js";
import { cacheGet, cacheSet } from "../lib/cache.js";

const router = Router();

// ─── GET /api/recalls ─────────────────────────────────────────────────────────

router.get("/recalls", async (_req, res) => {
  try {
    const c = getContract();
    if (!c) return res.json({ recalls: [], note: "Contract not deployed yet" });

    // Listen for BatchRecalled events from block 0 to now
    // This is a read-only scan of past events — fine for a demo
    const filter = c.filters.BatchRecalled();
    const events = await c.queryFilter(filter);

    const recalls = [];
    for (const ev of events) {
      const batchId = ev.args[0];
      // Try cache first
      let batchData = cacheGet(batchId);
      if (!batchData) {
        try {
          const [batch, history] = await Promise.all([
            c.getBatch(batchId),
            c.getHistory(batchId),
          ]);
          batchData = { batch: serialiseBatch(batch, history) };
          cacheSet(batchId, batchData);
        } catch {
          batchData = null;
        }
      }
      recalls.push({
        batchId,
        recalledBy: ev.args[1],
        reason:     ev.args[2],
        txHash:     ev.transactionHash,
        blockNumber: ev.blockNumber,
        batch:      batchData?.batch ?? null,
      });
    }

    return res.json({ recalls });
  } catch (err) {
    console.error("[admin] /recalls error:", err.message);
    return res.status(500).json({ error: "Failed to fetch recalls" });
  }
});

// ─── GET /api/regulator/stats ─────────────────────────────────────────────────

router.get("/regulator/stats", async (_req, res) => {
  try {
    const c = getContract();
    if (!c) return res.json({ note: "Contract not deployed yet" });

    // Count total registered batches from BatchRegistered events
    const regFilter = c.filters.BatchRegistered();
    const regEvents = await c.queryFilter(regFilter);

    // Count recalls
    const recFilter = c.filters.BatchRecalled();
    const recEvents = await c.queryFilter(recFilter);

    // Count transfers
    const txFilter = c.filters.BatchTransferred();
    const txEvents = await c.queryFilter(txFilter);

    const scanStats = getScanStats();
    const recentSuspicious = getRecentSuspicious(20);

    return res.json({
      batches: {
        total:    regEvents.length,
        recalled: recEvents.length,
        transfers: txEvents.length,
      },
      scans: scanStats,
      recentSuspicious,
    });
  } catch (err) {
    console.error("[admin] /regulator/stats error:", err.message);
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
