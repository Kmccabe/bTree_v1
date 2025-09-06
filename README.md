# bTree v1 — Trust Game (Algorand TestNet)

Professional, production‑oriented scaffold for a single‑pair Trust Game on Algorand TestNet.
The web client (under `frontend/`) uses React + Vite and Vercel serverless functions to
proxy all Algod/Indexer calls. Wallet signing is via Pera (`@txnlab/use-wallet`).

- Hosting: Vercel (Root Directory `frontend/`)
- Chain access: serverless `/api/*` → Algod/Indexer
- Contracts: TEAL in `frontend/src/teal/*.teal`

## Documentation

- Frontend README (run/deploy, UI): `frontend/README.md`
- Game design: `frontend/docs/trust-game-design.md`
- Variants & treatments: `frontend/docs/trust-game-variants.md`
- Manual smoke test: `tests/manual/SMOKE.md`

## Trust Game Flow (Phases & Funding)

- Phase 0 (Registration): S1 and S2 opt‑in (globals latch `s1`, `s2`).
- Phase 1 (Invest): S1 invests `s` (UNIT‑aligned, `s ≤ E1`).
  - Inner payment refund to S1: `E1 − s`.
  - App sets `t = m × s`; advance to Phase 2.
  - Funding before Invest: app liquid ≥ `E1 − s`.
- Phase 2 (Return): S2 returns `r` (`0 ≤ r ≤ t`, UNIT‑aligned).
  - Inner payments: `r → S1`; `(t − r + E2) → S2`.
  - Funding before Return: app liquid ≥ `t + E2`.
- Phase 3 (Done): Admin may Sweep (liquid → creator) and Delete app (creator‑only).
  - Note: app must always keep ≥ 0.1 ALGO minimum; Sweep moves only liquid (balance − min).

## Quick Start (Local)

1) Install UI dependencies
   - `cd frontend && npm i`
2) Configure serverless env (`frontend/.env.local`)
   - `TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud`
   - `TESTNET_ALGOD_TOKEN=` (blank for Algonode)
3) Run serverless and UI
   - Terminal A: `npx vercel dev` (exposes `/api` on :3000)
   - Terminal B: `npm run dev` (Vite on :5173; proxies `/api`)
4) Open http://localhost:5173, connect Pera (TestNet), use Admin panel to deploy/manage.

## Deploy to Vercel (Summary)

- Root Directory: `frontend/`
- Build Command: `npm run build`
- Output Directory: `dist`
- Server envs: `TESTNET_ALGOD_URL`, `TESTNET_ALGOD_TOKEN`
- Client envs (optional): `VITE_NETWORK`, `VITE_TESTNET_APP_ID`, etc.

## Project Structure (Top‑Level)

- `contracts/` — PyTeal scaffolds and tests
- `frontend/`
  - `api/` — serverless functions (`/api/*`)
  - `src/` — React app, TEAL, chain helpers, components
  - `public/` — static assets
- `tests/manual/SMOKE.md` — end‑to‑end manual script

## Troubleshooting

- Wallet network mismatch: ensure wallet = TestNet and UI `VITE_NETWORK=TESTNET`.
- `/api/*` 404 locally: ensure `npx vercel dev` is running.
- Pending not found: wait a few rounds; retry “Load globals/Read pair state”.
- History characters: viewer filters non‑printable logs; follow LoRA links to verify.

## Explorer

- LoRA (TestNet): https://lora.algokit.io/testnet
- App page: https://lora.algokit.io/testnet/app/<AppID>
- Tx page: https://lora.algokit.io/testnet/tx/<TXID>

For details on UI, APIs, and contract behavior, see `frontend/README.md` and the docs above.

