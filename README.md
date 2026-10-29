# MediChain — Fake-Medicine Detection DApp

> **"Scan it. Trust it."**

A blockchain-based medicine authentication platform built for the MST Blockchain Hackathon (Round 2).
Manufacturers register batches on-chain; every handoff is logged; patients scan a QR and get an
instant verdict: **VERIFIED**, **SUSPICIOUS**, **EXPIRED**, **RECALLED**, or **IN TRANSIT**.

---

## Problem

According to the WHO, 1 in 10 medicines in low- and middle-income countries is substandard or falsified.
Traditional paper-based or centralised supply-chain tracking systems can be altered by any party in the chain.
A patient buying antibiotics at a pharmacy has no reliable way to verify authenticity.

## Solution

MediChain puts the chain of custody on a public blockchain. Every participant — manufacturer, distributor,
pharmacy, regulator — has a cryptographic role. No party can alter history; anyone can read it.
A single QR-code scan gives a definitive verdict in under 2 seconds.

---

## Architecture

```mermaid
graph TD
    Patient -->|Scan QR| FE[Frontend: React + Vite]
    FE -->|GET /api/verify| BE[Backend: Express + SQLite]
    BE -->|ethers.js read| SC[MediChain.sol on MST Testnet]
    BE -->|cache 45s, invalidate on events| SC

    Mfg[Manufacturer] -->|MetaMask registerBatch| SC
    Dist[Distributor]  -->|MetaMask transferBatch| SC
    Phar[Pharmacy]     -->|MetaMask transferBatch| SC
    Reg[Regulator]     -->|MetaMask recallBatch|  SC

    SC -->|BatchTransferred event| BE
    SC -->|BatchRecalled event|   BE

    BE -->|record scan| DB[(SQLite)]
    BE -->|POST /api/batches/:id/qrs| QR[QR Generator: qrcode lib]
```

---

## On-Chain vs Off-Chain Data

| Data                          | Location   | Reason                                              |
|-------------------------------|------------|-----------------------------------------------------|
| Batch registration            | On-chain   | Immutable proof of provenance                       |
| Transfer history (mfg→dist→phar) | On-chain | Tamper-proof chain of custody                      |
| Recall events                 | On-chain   | Regulatory authority, globally visible              |
| Role assignments              | On-chain   | Trustless access control                            |
| Unit serial numbers           | Off-chain  | High volume, gas cost, not needed for core trust    |
| QR scan logs                  | Off-chain  | Privacy; no on-chain benefit                        |
| Suspicious flag detection     | Off-chain  | Heuristic; can be updated without redeployment      |
| Lab certificate hash (docHash)| On-chain   | Fingerprint of the certificate; certificate off-chain (no IPFS) |

---

## Tech Stack

| Layer     | Technology                                                          |
|-----------|---------------------------------------------------------------------|
| Blockchain | MST Testnet (EVM, chainId 91562037), Solidity ^0.8.20, OZ v5       |
| Contracts | Hardhat, ethers v6, Mocha/Chai                                      |
| Backend   | Node.js, Express, SQLite (better-sqlite3), ethers v6, qrcode, zod  |
| Frontend  | React 18, Vite, TailwindCSS, React Router v6, html5-qrcode, ethers v6 |
| Deploy    | Contracts → MST Testnet · Backend → Render · Frontend → Vercel     |

---

## Monorepo Structure

```
MediChain+/
├── contracts/             # Hardhat — Solidity
│   ├── contracts/
│   │   └── MediChain.sol
│   ├── scripts/
│   │   ├── check-network.js   # Phase 0 network check
│   │   ├── smoke.js           # Phase 0 Ping smoke test
│   │   ├── deploy.js          # Deployment + artifact writing
│   │   └── seed.js            # Demo data seeder
│   ├── test/
│   │   └── MediChain.test.js  # 15 test groups
│   └── hardhat.config.js
├── backend/               # Express + SQLite API
│   └── src/
│       ├── index.js
│       ├── db/schema.js
│       ├── lib/{cache,chain}.js
│       └── routes/{verify,qr,admin}.js
├── frontend/              # React + Vite + Tailwind
│   └── src/
│       ├── pages/{Landing,Scan,Verify,Dashboard,Demo}.jsx
│       ├── components/{Navbar,ResultBadge,JourneyTimeline}.jsx
│       └── lib/chain.js
├── docs/
│   ├── architecture.md
│   └── api.md
├── .env.example           # All env vars documented
├── .gitignore             # Covers .env, SQLite, node_modules, artifacts
├── vercel.json            # SPA rewrites for frontend
├── render.yaml            # Backend deploy config
├── Dockerfile             # Backend Docker image
├── README.md
└── DEMO_SCRIPT.md
```

---

## Setup

### Prerequisites
- Node.js 20+
- MetaMask browser extension
- An MST Testnet wallet (fund from https://faucet.mstblockchain.com/)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/medichain
cd medichain
npm install                   # installs root (concurrently)
cd contracts && npm install   # Hardhat + OpenZeppelin
cd ../backend && npm install  # Express deps
cd ../frontend && npm install # React + Vite deps
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env:
#   PRIVATE_KEY      = your deployer wallet private key
#   QR_SECRET        = openssl rand -hex 32
#   FRONTEND_URL     = http://localhost:5173 (dev) or your Vercel URL (prod)
#   VITE_API_URL     = http://localhost:3001
```

> **FRONTEND_URL note**: Set `FRONTEND_URL` to your Vercel URL **before** running `seed.js` to generate
> production QR codes. For local phone testing over Wi-Fi, use your machine's LAN IP:
> `FRONTEND_URL=http://192.168.1.42:5173` and point your phone to the same URL.

### 3. Run network check (Phase 0)

```bash
npm run check-network
```
If chainId ≠ 91562037, the script stops and tells you. **Do not proceed.**

### 4. Run smoke test

```bash
npm run smoke
```
Deploys a Ping contract to prove the toolchain works end-to-end.

### 5. Run contract tests

```bash
npm test
```
Runs 15 test groups on the local Hardhat network (no testnet required).

### 6. Deploy contract

```bash
npm run deploy --workspace=contracts -- --network mst
```
Writes `frontend/src/contract/index.js` and `backend/src/contract/contract.json`.

### 7. Seed demo data

```bash
npm run seed
```
Creates 4 demo batches, funds role accounts from deployer, generates QR URLs.
**Requires deployer balance ≥ 0.5 MSTC.**

### 8. Run locally

```bash
npm run dev
# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

---

## Deployed Contract

| | |
|--|--|
| **Network** | MST Testnet (chainId 91562037) |
| **Contract** | _Deploy and fill in address here_ |
| **Explorer** | https://testnet.mstscan.com/address/YOUR_CONTRACT_ADDRESS |
| **Deploy TX** | https://testnet.mstscan.com/tx/YOUR_TX_HASH |

---

## Live Demo Links

| | |
|--|--|
| **Frontend** | https://YOUR_PROJECT.vercel.app |
| **Backend**  | https://medichain-backend.onrender.com |

---

## Environment Variables

| Variable | Where used | Description |
|----------|-----------|-------------|
| `PRIVATE_KEY` | contracts | Deployer wallet private key |
| `MST_RPC_URL` | contracts, backend | MST Testnet RPC endpoint |
| `QR_SECRET` | backend | HMAC-SHA256 key for QR signatures |
| `FRONTEND_URL` | backend | Base URL for QR code links |
| `PORT` | backend | Server port (default 3001) |
| `VITE_API_URL` | frontend | Backend API base URL |
| `VITE_CHAIN_ID` | frontend | MST chain ID for MetaMask |
| `VITE_RPC_URL` | frontend | MST RPC for MetaMask auto-add |
| `VITE_EXPLORER_URL` | frontend | Block explorer base URL |

---

## Why Blockchain Over a Database?

Three parties — **manufacturer**, **distributor**, **pharmacy** — do not inherently trust each other.

1. **The manufacturer** cannot trust that the distributor didn't swap or divert batches.
2. **The distributor** cannot prove to the pharmacy that the batch is genuine.
3. **The pharmacy** cannot verify the full chain of custody on their own.

With a centralised database, any one party (or the company running the DB) could alter records.
A blockchain gives everyone a shared, immutable ledger:

- **Immutable history**: `getHistory()` returns every handoff, in order, with timestamps.
  No party can modify a past record — they can only append.
- **Trustless roles**: `AccessControl` means a distributor *cannot* register a batch;
  a manufacturer *cannot* transfer to a pharmacy directly. These rules are code, not policy.
- **Public auditability**: A regulator, journalist, or patient can independently verify
  any batch without asking anyone's permission.

---

## Limitations and Future Scope

### Current Limitations

- **Physical tamper-evidence gap**: MediChain verifies the *batch record*, not the physical pill.
  A sophisticated attacker could clone a QR code and attach it to counterfeit pills.
  **Mitigation**: Pair MediChain with tamper-evident holographic seals. If the seal is broken,
  the QR reveals that the original seal was intact at pharmacy delivery — a mismatch flags the strip.

- **Unit dispense is off-chain**: Marking a unit as "sold" (POST /api/units/:serial/dispense)
  is an off-chain soft signal. A determined attacker who scans before dispense could pass the check.
  **Tradeoff documented in code**. A future version could use a Merkle proof or ZK commitment.

- **No physical cold-chain data**: Temperature and humidity during transport are not tracked.

### Future Scope

1. **IoT cold-chain sensors**: Log temperature events on-chain at each handoff using sensor attestations.
2. **Tamper-evident NFC chips**: NFC-embedded packaging that self-destructs the QR link on first open.
3. **Regulator API integration**: Hook into CDSCO (India) or FDA APIs to cross-reference batch approvals.
4. **Expiry SMS reminders**: Backend job sends alerts to pharmacies before their stock expires.
5. **Layer-2 / rollup**: For production scale (millions of scans/day), move scan tracking to a L2.

---

## Contributing

This project was built in 4 days for the MST Blockchain Hackathon.
PRs are welcome! See `docs/api.md` for the full API reference.
