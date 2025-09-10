# API Reference

This document describes all serverless API endpoints available in the Trust Game application. All endpoints are proxied through Vercel serverless functions to provide secure access to Algorand TestNet.

## Base URL

**Local Development:** `http://localhost:3000/api/`  
**Production:** `https://your-app.vercel.app/api/`

## Authentication

No authentication required. All endpoints proxy to Algorand TestNet using server-side credentials configured via environment variables.

## Environment Variables

**Server-side (Required):**
- `TESTNET_ALGOD_URL`: Algorand node URL (e.g., `https://testnet-api.algonode.cloud`)
- `TESTNET_ALGOD_TOKEN`: Algorand node token (optional for some providers)
- `TESTNET_INDEXER_URL`: Algorand indexer URL (optional)
- `TESTNET_INDEXER_TOKEN`: Algorand indexer token (optional)

---

## Core Endpoints

### GET /api/health
Basic health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-09-10T10:00:00.000Z"
}
```

---

### GET /api/params
Get suggested transaction parameters from Algorand node.

**Parameters:** None

**Response:**
```json
{
  "consensus-version": "https://github.com/algorandfoundation/specs/tree/bc36005dbd776e6d1eaf0c560619bb183215645c",
  "fee": 1000,
  "genesis-hash": "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
  "genesis-id": "testnet-v1.0",
  "last-round": 42985503,
  "min-fee": 1000
}
```

**Usage:**
- Required for building Algorand transactions
- Provides current network parameters

---

### POST /api/compile
Compile TEAL source code to bytecode.

**Parameters:**
```json
{
  "teal": "string" // TEAL source code
}
```

**Response:**
```json
{
  "hash": "BYTECODE_HASH",
  "result": "BASE64_ENCODED_BYTECODE"
}
```

**Usage:**
- Compile smart contract code before deployment
- Returns bytecode for app creation transactions

---

### POST /api/submit
Submit signed transaction(s) to the Algorand network.

**Parameters:**
```json
{
  "txns": ["BASE64_ENCODED_SIGNED_TRANSACTION", ...]
}
```

**Response:**
```json
{
  "txId": "TRANSACTION_ID"
}
```

**Usage:**
- Submit transactions signed by wallet
- Supports both single transactions and groups

---

### GET /api/pending
Check transaction confirmation status.

**Parameters:**
- `txid` (query): Transaction ID to check

**Example:** `/api/pending?txid=ABC123...`

**Response:**
```json
{
  "confirmed-round": 42985504,
  "pool-error": "",
  "txn": {
    // Transaction details
  }
}
```

**Usage:**
- Poll for transaction confirmation
- Returns confirmation round when complete

---

## Account & Application Endpoints

### GET /api/account
Get account information including balance and application state.

**Parameters:**
- `addr` (query): Account address to query

**Example:** `/api/account?addr=ABC123...`

**Response:**
```json
{
  "address": "ABC123...",
  "amount": 1000000,
  "apps-local-state": [
    {
      "id": 12345,
      "key-value": [
        {
          "key": "BASE64_KEY",
          "value": {
            "type": 2,
            "uint": 100000
          }
        }
      ]
    }
  ]
}
```

**Usage:**
- Check account balance before transactions
- Read local application state for participants

---

### GET /api/pair
Get Trust Game application state and globals.

**Parameters:**
- `id` (query): Application ID

**Example:** `/api/pair?id=12345`

**Response:**
```json
{
  "id": 12345,
  "params": {
    "global-state": [
      {
        "key": "BASE64_KEY",
        "value": {
          "type": 2,
          "uint": 3000000
        }
      }
    ]
  }
}
```

**Usage:**
- Read game parameters (E1, E2, m, UNIT, phase)
- Check current game state
- Monitor phase transitions

---

### GET /api/local
Get local application state for a specific account.

**Parameters:**
- `addr` (query): Account address
- `appId` (query): Application ID

**Example:** `/api/local?addr=ABC123...&appId=12345`

**Response:**
```json
{
  "apps-local-state": [
    {
      "id": 12345,
      "key-value": [
        {
          "key": "cw==", // "s" in base64
          "value": {
            "type": 2,
            "uint": 1000000
          }
        }
      ]
    }
  ]
}
```

**Usage:**
- Read participant's local state (s, done, etc.)
- Check opt-in status

---

## Data Export Endpoints

### GET /api/history
Get transaction history for a Trust Game application.

**Parameters:**
- `id` (query): Application ID
- `limit` (query, optional): Number of transactions to return (default: 100)

**Example:** `/api/history?id=12345&limit=50`

**Response:**
```json
{
  "transactions": [
    {
      "id": "TRANSACTION_ID",
      "round-time": 1694358000,
      "sender": "ADDRESS",
      "application-transaction": {
        "application-id": 12345,
        "application-args": ["BASE64_ARG"],
        "inner-txns": [
          {
            "payment-transaction": {
              "amount": 1000000,
              "receiver": "ADDRESS"
            }
          }
        ]
      }
    }
  ]
}
```

**Usage:**
- View complete game transaction history
- Track investments and returns
- Export data for analysis

---

### GET /api/export
Export Trust Game data as CSV format.

**Parameters:**
- `appId` (query): Application ID to export

**Example:** `/api/export?appId=12345`

**Response:** CSV file with headers:
```
app_id,s1_addr,s2_addr,id_s1,id_s2,E1,E2,m,UNIT,s,r,t,payout_s1,payout_s2,tx_invest,round_invest,tx_return,round_return,ended_at
```

**Usage:**
- Export complete game data for research
- Generate reports and analytics
- Data integrity verification

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found (account/app doesn't exist)
- `500`: Internal Server Error (network issues, invalid configuration)

**Error Response Format:**
```json
{
  "error": "Error description",
  "details": "Additional error details (if available)"
}
```

---

## Rate Limiting

No explicit rate limiting is enforced, but endpoints are subject to:
- Algorand node rate limits
- Vercel serverless function limits
- Network timeout constraints (120 seconds default)

---

## Development Notes

### Local Testing
```bash
# Start serverless functions
npx vercel dev

# Test endpoint
curl http://localhost:3000/api/health
```

### Environment Setup
Create `frontend/.env.local`:
```bash
TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud
TESTNET_ALGOD_TOKEN=
TESTNET_INDEXER_URL=https://testnet-idx.algonode.cloud
```

### Common Patterns

**Transaction Submission Flow:**
1. `GET /api/params` - Get transaction parameters
2. Build transaction client-side
3. Sign with wallet
4. `POST /api/submit` - Submit to network
5. `GET /api/pending` - Wait for confirmation

**Game State Reading:**
1. `GET /api/pair?id=APP_ID` - Read global state
2. `GET /api/local?addr=ADDR&appId=APP_ID` - Read participant state
3. `GET /api/account?addr=APP_ADDRESS` - Check app funding

---

For implementation details, see the source code in `frontend/api/` directory.