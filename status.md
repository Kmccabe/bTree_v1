# Preflight & Debug

**Runtime:** Node 22.x  
**App root:** `frontend/` (Vite + Bundler)  
**API active:** `frontend/api/health.js` (others parked in `frontend/api_disabled/`)  
**Hobby cap:** ≤12 serverless functions

## Preflight (local)
**bash**
cd frontend
npm ci
npm run preflight  # tsc -b + vite build
#### Health Debug (local)
Health JSON: http://localhost:3000/api/health
Status page: http://localhost:5173/status
#### Health Debug (Vercel)
Health JSON: https://<your-vercel-host>/api/health
Status page: https://<your-vercel-host>/status
Env keys (testnet)
ALGOD_URL, INDEXER_URL (or TESTNET_/VITE_TESTNET_ variants)
ALGOD_TOKEN/ALGOD_TOKEN_HEADER (if needed)

