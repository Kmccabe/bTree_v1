# API Reference

This document describes all serverless API endpoints available in the Trust Game application. Endpoints are implemented as Vercel serverless functions and proxy to Algorand TestNet.

## Base URL

- Local: `http://localhost:3000/api/`
- Production: `https://<your-app>.vercel.app/api/`

## Authentication

- None. Endpoints rely on server-side env vars to reach Algod/Indexer.

## Environment Variables

- `TESTNET_ALGOD_URL`: Algorand node URL (e.g., `https://testnet-api.algonode.cloud`)
- `TESTNET_ALGOD_TOKEN`: Algorand node token (optional; some providers use X-API-Key)
- `TESTNET_INDEXER_URL`: Indexer URL (default: `https://testnet-idx.algonode.cloud`)
- `TESTNET_INDEXER_TOKEN`: Indexer token (optional)

---

## Endpoints Overview (10)

- `GET /api/health`
- `GET /api/params`
- `POST /api/compile`
- `POST /api/submit`
- `GET /api/pending?txid=...`
- `GET /api/account?addr=...`
- `GET /api/pair?id=...`
- `GET /api/local?addr=...&id=...`
- `GET /api/history?id=...&limit=...`
- `GET /api/export?appId=...`

---

## `GET /api/health`
Basic health check.

- Status: 200 always when function is reachable
- Response:
```json
{ "ok": true, "message": "Vercel is alive" }
```
- Example:
```bash
curl -s http://localhost:3000/api/health
```

---

## `GET /api/params`
Fetch SuggestedParams from Algod.

- Query: none
- Success 200: Algod params JSON
- Error 500: `{ "error": "params failed" }`
- Example:
```bash
curl -s http://localhost:3000/api/params | jq .
```

---

## `POST /api/compile`
Compile TEAL source to bytecode via Algod.

- Body (JSON):
```json
{ "source": "#pragma version 9\nint 1" }
```
- Success 200: Algod compile JSON (`hash`, `result`)
- Client error 400: `{ "error": "missing 'source' (TEAL)" }` or Algod error
- Server error 500: `{ "error": "compile failed" }`
- Example:
```bash
curl -sX POST http://localhost:3000/api/compile \
  -H 'content-type: application/json' \
  -d '{"source":"#pragma version 9\nint 1"}'
```

---

## `POST /api/submit`
Submit signed transaction(s) to the network.

- Body (JSON): one of
```json
{ "signedTxnBase64": "..." }
```
or
```json
{ "stxns": ["...", "..."] }
```
- Success 200: Algod JSON (e.g., `{ "txId": "..." }`)
- Client error 400: `{ "error": "missing 'signedTxnBase64' or 'stxns'" }` or forwarded Algod error
- Server error 500: `{ "error": "submit failed" }`
- Example (group upload):
```bash
curl -sX POST http://localhost:3000/api/submit \
  -H 'content-type: application/json' \
  -d '{"stxns":["BASE64_TXN_1","BASE64_TXN_2"]}'
```

---

## `GET /api/pending`
Check pending transaction status.

- Query: `txid` (required)
- Success 200: Algod pending info JSON
- Client error 400: `{ "error": "missing txid" }`
- Server error 500: `{ "error": "pending failed" }`
- Example:
```bash
curl -s 'http://localhost:3000/api/pending?txid=ABC...'
```

---

## `GET /api/account`
Get simplified account info.

- Query: `addr` (required)
- Success 200:
```json
{ "address": "...", "amount": 1000000, "min-balance": 100000, "apps-local-state": 1 }
```
- Client error 400: `{ "error": "addr required" }`
- Proxy errors: non-200 from Algod are forwarded with `status` and `{ error }`
- Example:
```bash
curl -s 'http://localhost:3000/api/account?addr=ADDR'
```

---

## `GET /api/pair`
Get application globals and decoded metadata.

- Query: `id` (required, integer App ID)
- Success 200:
```json
{ "id": 12345, "creator": "...", "globalSchema": {"ints": 6, "bytes": 4},
  "globals": { "E1": 2000000, "E2": 500000, "m": 3, "UNIT": 100000, "phase": 2 },
  "globalsRaw": [ { "key": "E1", "type": "uint", "uint": 2000000 } ] }
```
- Client error 400: `{ "error": "id (positive integer) required" }`
- Proxy errors: non-200 from Algod are forwarded with status and `{ error }`
- Bad gateway 502: `{ "error": "algod returned non-JSON response" }`
- Example:
```bash
curl -s 'http://localhost:3000/api/pair?id=12345' | jq .
```

---

## `GET /api/local`
Get local state for an address and app.

- Query: `addr` (required), `id` (required App ID)
- Success 200:
```json
{ "id": 12345, "address": "ADDR", "local": { "s": 100000, "done": 1 } }
```
- Client error 400: `{ "error": "addr required" }` or `{ "error": "id required" }`
- Proxy errors: non-200 from Algod are forwarded with status and `{ error }`
- Bad gateway 502: `{ "error": "algod returned non-JSON response" }`
- Example:
```bash
curl -s 'http://localhost:3000/api/local?addr=ADDR&id=12345'
```

---

## `GET /api/history`
List recent app-call transactions with decoded args and inner payments.

- Query: `id` or `appId` (required), `limit` (default 100, max 1000)
- Success 200:
```json
{ "id": 12345, "count": 2,
  "txns": [
    { "round": 1, "time": 1694358000, "txid": "...", "sender": "...",
      "event": "invest", "details": { "s": 100000 }, "innerPayments": [] }
  ] }
```
- Client/Proxy errors: forwarded as `{ error }` with appropriate status
- Example:
```bash
curl -s 'http://localhost:3000/api/history?id=12345&limit=5' | jq .
```

---

## `GET /api/export`
Export CSV of app-call events suitable for offline analysis.

- Query: `appId` (required), optional: `minRound`, `maxRound`
- Success 200: `text/csv` with header:
```text
round,round_time,txid,sender,event,details_json
```
- Server error 500: `{ "error": "..." }`
- Example:
```bash
curl -s 'http://localhost:3000/api/export?appId=12345' -o btree_export_app_12345.csv
```

---

## Error Handling

- 200: Successful proxy
- 400: Missing/invalid parameters or Algod error
- 405: Method not allowed (e.g., `POST /compile` only)
- 500: Server error (network/config failures)

Errors are returned as JSON:
```json
{ "error": "message" }
```

---

## Development Notes

### Local Testing
```bash
# Start serverless functions alongside the app
cd frontend
npx vercel dev

# Test an endpoint
curl -s http://localhost:3000/api/health
```

### Environment Setup
Create `frontend/.env.local`:
```bash
TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud
TESTNET_ALGOD_TOKEN=
TESTNET_INDEXER_URL=https://testnet-idx.algonode.cloud
TESTNET_INDEXER_TOKEN=
```

### Common Patterns

Transaction submission flow:
1. `GET /api/params` → SuggestedParams
2. Build unsigned txns with `algosdk`
3. Sign via wallet
4. `POST /api/submit` with `signedTxnBase64` or `stxns`
5. `GET /api/pending` until confirmed

State reading:
1. `GET /api/pair?id=APP_ID` → globals
2. `GET /api/local?addr=ADDR&id=APP_ID` → local
3. `GET /api/account?addr=APP_ADDRESS` → funding check

---

Implementation sources live in `frontend/api/`.
