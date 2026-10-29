const BASE = process.env.API || "http://localhost:3001";
const batch = process.argv[2];
const qr = async (b) => {
  const r = await fetch(`${BASE}/api/batches/${b}/qrs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 1 }) });
  const j = await r.json(); const u = new URL(j.qrs[0].url);
  return { serial: j.qrs[0].serial, sig: u.searchParams.get("sig") };
};
const scan = async (b, s, sig, session) => (await fetch(`${BASE}/api/verify/${b}?s=${encodeURIComponent(s)}&sig=${encodeURIComponent(sig)}&session=${session}`)).json();
const { serial, sig } = await qr(batch);
for (const s of ["s1", "s2", "s3"]) { const j = await scan(batch, serial, sig, s); console.log(s, j.result ?? j.status, JSON.stringify(j.reasons)); }
const bad = sig.slice(0, -1) + (sig.at(-1) === "0" ? "1" : "0");
console.log("tampered", (await scan(batch, serial, bad, "s9")).result);
