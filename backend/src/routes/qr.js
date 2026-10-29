/**
 * backend/src/routes/qr.js
 * QR code generation and unit dispense endpoints.
 *
 * POST /api/batches/:batchId/qrs
 *   Body: { count: number }
 *   Returns: { qrs: [{ serial, dataUrl }], zipUrl }
 *   Also creates a downloadable ZIP with all PNG files.
 *
 * POST /api/units/:serial/dispense
 *   Body: { sessionId? }
 *   Marks a unit as sold (off-chain). Documented tradeoff: this is
 *   a best-effort protection, not a cryptographic guarantee. A sufficiently
 *   motivated attacker who scans before dispense will still pass the
 *   sold-check. The on-chain transfer to a pharmacy is the authoritative
 *   proof of legitimacy; dispense is an additional soft signal.
 */

import { Router } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import archiver from "archiver";
import { z } from "zod";
import { dispenseUnit, getUnit, ensureUnit } from "../db/schema.js";

const router = Router();

const QR_SECRET = process.env.QR_SECRET || "change_me_in_production";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ─── HMAC helper (same logic as verify.js — keep in sync) ────────────────────

function computeHmac(batchId, serial) {
  return crypto
    .createHmac("sha256", QR_SECRET)
    .update(`${batchId}:${serial}`)
    .digest("hex");
}

function buildQrUrl(batchId, serial) {
  const sig = computeHmac(batchId, serial);
  // batchId is a bytes32 hex string — URL-safe
  return `${FRONTEND_URL}/verify/${batchId}?s=${encodeURIComponent(serial)}&sig=${sig}`;
}

function generateSerial(batchId, index) {
  // Short deterministic serial: first 6 chars of HMAC(batchId+index)
  const h = crypto
    .createHmac("sha256", QR_SECRET)
    .update(`${batchId}-unit-${index}`)
    .digest("hex");
  return `${h.slice(0, 6).toUpperCase()}-${String(index).padStart(6, "0")}`;
}

// ─── POST /api/batches/:batchId/qrs ──────────────────────────────────────────

const QrBodySchema = z.object({
  count: z.number().int().min(1).max(1000),
});

router.post("/:batchId/qrs", async (req, res) => {
  const { batchId } = req.params;

  const parsed = QrBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "count must be an integer 1–1000" });
  }

  const { count } = parsed.data;

  try {
    const qrs = [];

    for (let i = 1; i <= count; i++) {
      const serial = generateSerial(batchId, i);
      const url = buildQrUrl(batchId, serial);

      // Generate QR as a data URL (PNG, base64)
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "H",
        type: "image/png",
        width: 300,
        margin: 2,
        color: { dark: "#0d9488", light: "#ffffff" }, // teal/white brand colours
      });

      // Ensure unit record exists in SQLite
      ensureUnit(serial, batchId);

      qrs.push({ serial, url, dataUrl });
    }

    // Return the QR data URLs and ZIP stream info
    return res.json({
      batchId,
      count,
      qrs,
      note: `QR codes built from FRONTEND_URL=${FRONTEND_URL}. ` +
            "Set FRONTEND_URL to your Vercel URL before generating production QRs.",
    });
  } catch (err) {
    console.error("[QR] generation error:", err);
    return res.status(500).json({ error: "QR generation failed" });
  }
});

// ─── GET /api/batches/:batchId/qrs/zip ───────────────────────────────────────
// Returns a ZIP archive of all QR PNGs for a batch (re-generates on demand).

router.get("/:batchId/qrs/zip", async (req, res) => {
  const { batchId } = req.params;
  const count = parseInt(req.query.count || "10", 10);

  if (count < 1 || count > 1000) {
    return res.status(400).json({ error: "count must be 1–1000" });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="qr-${batchId.slice(0, 10)}.zip"`
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  for (let i = 1; i <= count; i++) {
    const serial = generateSerial(batchId, i);
    const url = buildQrUrl(batchId, serial);

    // Generate PNG buffer
    const pngBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: "H",
      type: "png",
      width: 300,
      margin: 2,
    });

    archive.append(pngBuffer, { name: `${serial}.png` });
  }

  await archive.finalize();
});

// ─── POST /api/units/:serial/dispense ────────────────────────────────────────

router.post("/units/:serial/dispense", (req, res) => {
  const { serial } = req.params;
  const sessionId = req.body?.sessionId || req.headers["x-session-id"] || null;

  const unit = getUnit(serial);
  if (!unit) {
    return res.status(404).json({ error: "Unit serial not found" });
  }

  if (unit.dispensed) {
    return res.status(409).json({
      error: "Unit already dispensed",
      dispensedAt: unit.dispensed_at,
    });
  }

  dispenseUnit(serial, sessionId);
  return res.json({ ok: true, serial, dispensedAt: Date.now() });
});

// Mount dispense at top-level for router — handled in index.js as /api/batches
export default router;
