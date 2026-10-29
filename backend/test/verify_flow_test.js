// backend/test/verify_flow_test.js
// Verify flow integration test
// Usage: node test/verify_flow_test.js [batchId]
// If batchId not provided, defaults to first batch from contracts/seed-output.json

import "dotenv/config";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadDefaultBatchId() {
  try {
    const seedPath = resolve(__dirname, "../../contracts/seed-output.json");
    const data = JSON.parse(await readFile(seedPath, "utf8"));
    if (Array.isArray(data.batches) && data.batches.length) {
      return data.batches[0].batchId;
    }
    const raw = await readFile(seedPath, "utf8");
    const match = raw.match(/BatchId\s*:\s*(0x[0-9a-fA-F]+)/);
    return match ? match[1] : null;
  } catch (e) {
    console.error("Failed to read seed-output.json", e);
    return null;
  }
}

async function getQrInfo(batchId) {
  const resp = await fetch(`http://localhost:${process.env.PORT || 3001}/api/batches/${batchId}/qrs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: 1 }),
  });
  if (!resp.ok) throw new Error(`QR generation failed: ${resp.status}`);
  const data = await resp.json();
  const { serial, url } = data.qrs[0];
  const urlObj = new URL(url);
  const sig = urlObj.searchParams.get("sig");
  return { serial, sig };
}

async function verifyScan(batchId, serial, sig, sessionId) {
  const resp = await fetch(
    `http://localhost:${process.env.PORT || 3001}/api/verify/${batchId}?s=${encodeURIComponent(
      serial
    )}&sig=${encodeURIComponent(sig)}`,
    {
      method: "GET",
      headers: { "x-session-id": sessionId },
    }
  );
  const json = await resp.json();
  return json;
}

async function run() {
  const argBatchId = process.argv[2];
  const batchId = argBatchId || (await loadDefaultBatchId());
  if (!batchId) {
    console.error("No batchId supplied and could not infer from seed-output.json");
    process.exit(1);
  }
  console.log(`Using batchId: ${batchId}`);
  const { serial, sig } = await getQrInfo(batchId);
  console.log(`Generated fresh serial: ${serial}`);

  const scenarios = [
    { session: "sess-1", expect: "VERIFIED" },
    { session: "sess-1", expect: "NOT_SUSPICIOUS" },
    { session: "sess-2", expect: "SUSPICIOUS" },
  ];

  let allPass = true;
  for (const { session, expect } of scenarios) {
    const result = await verifyScan(batchId, serial, sig, session);
    const status = result.result || result.error || "UNKNOWN";
    const pass = status === expect;
    allPass = allPass && pass;
    console.log(`[${session}] expected: ${expect}, got: ${status} → ${pass ? "PASS" : "FAIL"}`);
    console.log(JSON.stringify(result, null, 2));
  }

  if (!allPass) process.exit(1);
}

run().catch((e) => {
  console.error("Test execution error", e);
  process.exit(1);
});
