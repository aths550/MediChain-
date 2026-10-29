/**
 * backend/src/db/schema.js
 * SQLite schema and initialisation using better-sqlite3.
 *
 * Tables:
 *   scans   — every QR scan event
 *   units   — unit serial numbers and their sold state
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "medichain.db");

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL"); // better concurrency
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function initDb() {
  const db = getDb();

  db.exec(`
    -- Track every QR scan event
    CREATE TABLE IF NOT EXISTS scans (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id    TEXT    NOT NULL,
      serial      TEXT    NOT NULL,
      session_id  TEXT,
      ip_hash     TEXT,           -- SHA-256 of IP for privacy
      user_agent  TEXT,
      result      TEXT    NOT NULL,  -- VERIFIED/SUSPICIOUS/EXPIRED/RECALLED/UNKNOWN/IN_TRANSIT
      scanned_at  INTEGER NOT NULL   -- unix timestamp (ms)
    );

    CREATE INDEX IF NOT EXISTS idx_scans_batch_serial ON scans(batch_id, serial);
    CREATE INDEX IF NOT EXISTS idx_scans_serial_time  ON scans(serial, scanned_at);

    -- Track unit serials and their dispensed state
    CREATE TABLE IF NOT EXISTS units (
      serial       TEXT    PRIMARY KEY,
      batch_id     TEXT    NOT NULL,
      dispensed    INTEGER NOT NULL DEFAULT 0,   -- 0=false, 1=true
      dispensed_at INTEGER,                       -- unix timestamp (ms)
      session_id   TEXT                           -- session that dispensed it
    );

    CREATE INDEX IF NOT EXISTS idx_units_batch ON units(batch_id);
  `);

  // Migration: add owner_session_id column if missing
  const cols = db.prepare(`PRAGMA table_info(units)`).all();
  if (!cols.some(c => c.name === 'owner_session_id')) {
    db.exec(`ALTER TABLE units ADD COLUMN owner_session_id TEXT;`);
    console.log('[DB] Added owner_session_id column to units');
  }

  console.log(`[DB] SQLite initialised at ${DB_PATH}`);
  return db;
}

// ─── Unit helpers ─────────────────────────────────────────────────────────────

/** Insert or ignore a serial (created lazily on first scan if not pre-generated) */
export function ensureUnit(serial, batchId) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO units (serial, batch_id) VALUES (?, ?)
  `).run(serial, batchId);
}

/** Mark a unit as dispensed (sold) */
export function dispenseUnit(serial, sessionId) {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    UPDATE units SET dispensed = 1, dispensed_at = ?, session_id = ?
    WHERE serial = ?
  `).run(now, sessionId, serial);
}

/** Get unit record */
export function getUnit(serial) {
  return getDb().prepare("SELECT * FROM units WHERE serial = ?").get(serial);
}

// Set owner session atomically (only if not already set)
export function setOwnerSession(serial, sessionId) {
  const db = getDb();
  db.prepare(`UPDATE units SET owner_session_id = ? WHERE serial = ? AND owner_session_id IS NULL`).run(sessionId, serial);
}

// ─── Scan helpers ─────────────────────────────────────────────────────────────

/** Record a scan event */
export function recordScan({ batchId, serial, sessionId, ipHash, userAgent, result }) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO scans (batch_id, serial, session_id, ip_hash, user_agent, result, scanned_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, serial, sessionId || null, ipHash || null, userAgent || null, result, Date.now());
  return info.lastInsertRowid;
}
export function updateScanResultById(id, result) {
  const db = getDb();
  db.prepare(`UPDATE scans SET result = ? WHERE id = ?`).run(result, id);
}
/**
 * Count distinct sessions for this serial in the last 24 hours.
 * Used for SUSPICIOUS detection (clone attack).
 */
export function countRecentSessions(serial) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const row = getDb()
    .prepare(`
      SELECT COUNT(DISTINCT session_id) as cnt
      FROM scans
      WHERE serial = ? AND scanned_at >= ? AND session_id IS NOT NULL
    `)
    .get(serial, since);
  return row?.cnt ?? 0;
}

/** Get aggregate scan stats (for regulator dashboard) */
export function getScanStats() {
  const db = getDb();
  return {
    totalScans:      db.prepare("SELECT COUNT(*) as c FROM scans").get().c,
    verifiedScans:   db.prepare("SELECT COUNT(*) as c FROM scans WHERE result='VERIFIED'").get().c,
    suspiciousScans: db.prepare("SELECT COUNT(*) as c FROM scans WHERE result='SUSPICIOUS'").get().c,
    expiredScans:    db.prepare("SELECT COUNT(*) as c FROM scans WHERE result='EXPIRED'").get().c,
    recalledScans:   db.prepare("SELECT COUNT(*) as c FROM scans WHERE result='RECALLED'").get().c,
    unknownScans:    db.prepare("SELECT COUNT(*) as c FROM scans WHERE result='UNKNOWN'").get().c,
  };
}

/** Get recent suspicious scan flags */
export function getRecentSuspicious(limit = 50) {
  return getDb()
    .prepare(`
      SELECT * FROM scans WHERE result = 'SUSPICIOUS'
      ORDER BY scanned_at DESC LIMIT ?
    `)
    .all(limit);
}
