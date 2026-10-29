# API Reference

Base URL: `http://localhost:3001` (dev) or `https://medichain-backend.onrender.com` (prod)

---

## Verify Endpoint

### `GET /api/verify/:batchId`

Verify a medicine QR code scan.

**Query Parameters**

| Param     | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `s`       | string | Yes      | Unit serial number                   |
| `sig`     | string | Yes      | HMAC-SHA256 signature (64 hex chars) |
| `session` | string | No       | Session ID for clone detection       |

**Headers**

| Header          | Description                   |
|-----------------|-------------------------------|
| `x-session-id`  | Fallback session ID           |

**Response**

```json
{
  "result": "VERIFIED",
  "reasons": ["All checks passed. This medicine is genuine."],
  "batch": {
    "batchId": "0xabc...",
    "drugName": "Amoxicillin 500mg",
    "manufacturerName": "PharmaCo Ltd",
    "manufactureDate": 1700000000,
    "expiryDate": 1731600000,
    "quantity": 1000,
    "docHash": "0xdef...",
    "originalManufacturer": "0x1234...",
    "currentHolder": "0x5678...",
    "currentStage": "Pharmacy",
    "status": "Active",
    "recallReason": "",
    "history": [
      {
        "from": "0x1234...",
        "to": "0x9abc...",
        "timestamp": 1700001000,
        "note": "Shipped to distributor"
      }
    ]
  }
}
```

**Result values** (evaluated in order):

| Result       | Condition                                                   |
|-------------|-------------------------------------------------------------|
| `UNKNOWN`    | Batch not on-chain or HMAC signature invalid                |
| `RECALLED`   | Batch status is recalled                                    |
| `EXPIRED`    | Current time > expiryDate                                   |
| `IN_TRANSIT` | Batch has not reached a pharmacy yet (soft warning)         |
| `SUSPICIOUS` | >2 distinct sessions in 24h, or sold+rescanned from diff session |
| `VERIFIED`   | All checks passed                                           |

**Rate limit**: 30 requests/minute per IP.

---

## QR Code Generation

### `POST /api/batches/:batchId/qrs`

Generate unit QR codes for a batch.

**Body**
```json
{ "count": 10 }
```

**Response**
```json
{
  "batchId": "0xabc...",
  "count": 10,
  "qrs": [
    {
      "serial": "A1B2C3-000001",
      "url": "https://your-frontend.vercel.app/verify/0xabc...?s=A1B2C3-000001&sig=def...",
      "dataUrl": "data:image/png;base64,..."
    }
  ],
  "note": "QR codes built from FRONTEND_URL=https://..."
}
```

### `GET /api/batches/:batchId/qrs/zip`

Download ZIP archive of QR PNGs.

**Query Parameters**: `?count=10`

**Response**: `application/zip` attachment.

---

## Unit Dispense

### `POST /api/batches/units/:serial/dispense`

Mark a unit as sold at a pharmacy. Off-chain only.

> **Tradeoff**: This is a best-effort soft signal, not a cryptographic guarantee.
> The on-chain pharmacy transfer is the authoritative proof of legitimacy.
> A sophisticated attacker who scans before dispense will still pass the sold-check on first scan.

**Body**
```json
{ "sessionId": "optional-session-id" }
```

**Response**
```json
{ "ok": true, "serial": "A1B2C3-000001", "dispensedAt": 1700001234567 }
```

---

## Admin / Regulator

### `GET /api/recalls`

List all recalled batches (from on-chain events).

**Response**
```json
{
  "recalls": [
    {
      "batchId": "0xabc...",
      "recalledBy": "0x5678...",
      "reason": "Contamination detected",
      "txHash": "0xdef...",
      "blockNumber": 12345,
      "batch": { ... }
    }
  ]
}
```

### `GET /api/regulator/stats`

Aggregate statistics for the regulator dashboard.

**Response**
```json
{
  "batches": {
    "total": 42,
    "recalled": 3,
    "transfers": 85
  },
  "scans": {
    "totalScans": 1200,
    "verifiedScans": 1100,
    "suspiciousScans": 15,
    "expiredScans": 50,
    "recalledScans": 30,
    "unknownScans": 5
  },
  "recentSuspicious": [ ... ]
}
```

---

## Health Check

### `GET /health`

```json
{ "status": "ok", "timestamp": "2024-11-15T10:30:00.000Z" }
```
