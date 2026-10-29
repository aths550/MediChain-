/**
 * backend/src/routes/verify.js
 * GET /api/verify/:batchId?s=<serial>&sig=<hmac>&session=<sessionId>
 *
 * 1. Validate HMAC signature on the QR code
 * 2. Fetch batch from chain (cache-first, 45s TTL)
 * 3. Record scan in SQLite
 * 4. Determine result in order: UNKNOWN → RECALLED → EXPIRED → IN_TRANSIT → SUSPICIOUS → VERIFIED
 * 5. Return {result, reasons, batch, scanStats}
 */

import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { cacheGet, cacheSet } from "../lib/cache.js";
import { fetchBatch, serialiseBatch } from "../lib/chain.js";
import {
  recordScan,
  updateScanResultById,
  countRecentSessions,
  getUnit,
  ensureUnit,
  setOwnerSession,
} from "../db/schema.js";

const router = Router();

const QR_SECRET = process.env.QR_SECRET || "change_me_in_production";

// ─── HMAC validation ──────────────────────────────────────────────────────────

function computeHmac(batchId, serial) {
  return crypto
    .createHmac("sha256", QR_SECRET)
    .update(`${batchId}:${serial}`)
    .digest("hex");
}

function validateHmac(batchId, serial, sig) {
  const expected = computeHmac(batchId, serial);
  // Constant-time compare to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sig.padEnd(expected.length, "0").slice(0, expected.length), "hex")
    );
  } catch {
    return false;
  }
}

// ─── Input schema ─────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  s:       z.string().min(1).max(128),  // serial
  sig:     z.string().length(64),       // HMAC hex
  session: z.string().max(128).optional(),
});

// ─── IP hashing (privacy) ─────────────────────────────────────────────────────

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip || "").digest("hex").slice(0, 16);
}

// ─── Result determination ─────────────────────────────────────────────────────

/**
 * Determine the verification result and reasons.
 * Evaluation order (strict):
 *   1. UNKNOWN   — batch not on-chain or HMAC invalid
 *   2. RECALLED  — batch.status === "Recalled"
 *   3. EXPIRED   — current time > batch.expiryDate
 *   4. IN_TRANSIT — batch has not reached a pharmacy yet (soft warning)
 *   5. SUSPICIOUS — duplicate-scan attack (>2 distinct sessions/24h) or sold+rescanned
 *   6. VERIFIED
 */
function determineResult(batchData, serial, sessionId) {
  const reasons = [];

  if (!batchData) {
    return { result: "UNKNOWN", reasons: ["Batch not found on-chain. This medicine may be counterfeit."] };
  }

  const { batch } = batchData;
  const nowSec = Math.floor(Date.now() / 1000);

  if (batch.status === "Recalled") {
    reasons.push(`This batch has been recalled: ${batch.recallReason || "No reason given"}`);
    return { result: "RECALLED", reasons };
  }

  if (nowSec > batch.expiryDate) {
    const expiredDate = new Date(batch.expiryDate * 1000).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
    reasons.push(`This batch expired on ${expiredDate}.`);
    return { result: "EXPIRED", reasons };
  }

  // IN_TRANSIT: batch never reached a pharmacy
  if (batch.currentStage !== "Pharmacy") {
    reasons.push(
      `In transit — this batch is currently at a ${batch.currentStage} and has not reached a pharmacy yet.`
    );
    return { result: "IN_TRANSIT", reasons };
  }

  // SUSPICIOUS checks (only run if batch is at pharmacy, active, not expired)
  const suspiciousReasons = [];

  // Check 1: too many distinct sessions in 24h (clone attack)
  const sessionCount = countRecentSessions(serial);
  if (sessionCount > 2) {
    suspiciousReasons.push(
      `This QR code was scanned from ${sessionCount} different devices/sessions in the last 24 hours — possible clone attack.`
    );
  }

  // Check 2: sold-then-rescanned from a different session (owner_session_id)
  const unit = getUnit(serial);
  if (unit?.dispensed && unit.owner_session_id && unit.owner_session_id !== sessionId) {
    suspiciousReasons.push(
      "This unit was already dispensed (sold) to a patient. Scanning it again from a different session is suspicious."
    );
  }

  if (suspiciousReasons.length > 0) {
    return { result: "SUSPICIOUS", reasons: suspiciousReasons };
  }

  return { result: "VERIFIED", reasons: ["All checks passed. This medicine is genuine."] };
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get("/:batchId", async (req, res) => {
  const { batchId } = req.params;

  // Validate query params
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      result: "UNKNOWN",
      reasons: ["Invalid QR code. Required parameters are missing or malformed."],
      errors: parsed.error.issues,
    });
  }

  const { s: serial, sig, session } = parsed.data;
  const sessionId = session || req.headers["x-session-id"] || null;
  const ipHash = hashIp(req.ip);
  const userAgent = req.headers["user-agent"] || "";

  // ── 1. Validate HMAC ──────────────────────────────────────────────────────
  const hmacValid = validateHmac(batchId, serial, sig);
  if (!hmacValid) {
    // No scan recorded for invalid HMAC
    return res.json({
      result: "UNKNOWN",
      reasons: ["QR code signature is invalid. This QR code may have been tampered with."],
      batch: null,
      scanStats: null,
    });
  }

  // ── 2. Fetch batch (cache-first) ──────────────────────────────────────────
  let batchData = cacheGet(batchId);
  if (!batchData) {
    const onChain = await fetchBatch(batchId);
    if (onChain) {
      batchData = {
        batch: serialiseBatch(onChain.batch, onChain.history),
      };
      cacheSet(batchId, batchData);
    }
  }

  // ── 3. Ensure unit exists in SQLite ───────────────────────────────────────
  ensureUnit(serial, batchId);

  // If unit has been dispensed but owner_session_id not set, set it now
  const unitRecord = getUnit(serial);
  if (unitRecord?.dispensed && !unitRecord.owner_session_id) {
    setOwnerSession(serial, sessionId);
  }

  // ── 4. Insert placeholder scan (result to be filled later) ─────────────────
  const scanId = recordScan({ batchId, serial, sessionId, ipHash, userAgent, result: "PENDING" });

  // ── 5. Determine result ───────────────────────────────────────────────────
  let resultObj;
  try {
    resultObj = determineResult(batchData, serial, sessionId);
    // Update scan with final result
    updateScanResultById(scanId, resultObj.result);
  } catch (err) {
    // On error, set result to ERROR
    updateScanResultById(scanId, "ERROR");
    console.error("[verify] error determining result:", err);
    resultObj = { result: "ERROR", reasons: ["Internal verification error."] };
  }

  // ── 6. Respond ────────────────────────────────────────────────────────────
  const responsePayload = {
    result: resultObj.result,
    reasons: resultObj.reasons,
    batch: batchData?.batch ?? null,
  };
  return res.json(responsePayload);
});

export default router;
