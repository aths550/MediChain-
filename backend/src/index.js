/**
 * backend/src/index.js
 * MediChain Express server entry point.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { initDb } from "./db/schema.js";
import verifyRouter from "./routes/verify.js";
import qrRouter from "./routes/qr.js";
import adminRouter from "./routes/admin.js";

const PORT = process.env.PORT || 3001;
const rawFrontend = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_URL = rawFrontend.replace(/\/+$/, "");

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();

app.use(express.json());
// Ensure BigInt values are safely stringified in JSON responses
app.set("json replacer", (k, v) => typeof v === "bigint" ? v.toString() : v);

// CORS: only allow requests from the configured frontend URL
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow no-origin requests (curl, Postman, same-origin SSR)
      if (!origin || origin === FRONTEND_URL) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Rate limiting on verify endpoint to prevent scanning abuse
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/verify", verifyLimiter, verifyRouter);
app.use("/api/batches", qrRouter);
// /api/units/:serial/dispense is handled inside qrRouter at /units/:serial/dispense
// so the full path is /api/batches/units/:serial/dispense — see routes/qr.js
app.use("/api", adminRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  // Initialise SQLite (creates tables if not present)
  initDb();

  app.listen(PORT, () => {
    console.log(`\n🚀 MediChain backend running on http://localhost:${PORT}`);
    console.log(`   CORS origin: ${FRONTEND_URL}`);
    console.log(`   Env: ${process.env.NODE_ENV || "development"}\n`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
