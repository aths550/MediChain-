# MediChain — Project Submission Description

**Under 150 words for the submission form:**

---

MediChain is a blockchain-based fake-medicine detection DApp built on the MST Testnet.
Manufacturers register medicine batches on-chain with an immutable record; every handoff — manufacturer
to distributor to pharmacy — is logged via smart contract enforcing strict role-based order.
Patients scan a QR code and instantly receive one of five verdicts: VERIFIED, SUSPICIOUS,
EXPIRED, RECALLED, or IN TRANSIT, with the full supply chain journey and timestamps.

The system uses OpenZeppelin AccessControl, HMAC-signed QR codes, a 45-second read-through cache,
and real-time cache invalidation on blockchain events. A React + Vite frontend handles camera
scanning and MetaMask-connected role dashboards. A Node.js/Express backend with SQLite tracks
unit-level scans and detects clone attacks (>2 distinct sessions scanning the same QR in 24 hours).

Three parties who don't trust each other — one ledger nobody can alter.

**Tagline**: *"Scan it. Trust it."*
