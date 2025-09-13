# Trust Game Frontend (Vercel‑Ready)

This is the TestNet web client for the single‑pair Trust Game. It uses React + Vite with serverless API routes to proxy all Algod/Indexer calls.

**Highlights**
- React + TypeScript + Vite; Wallet via `@txnlab/use-wallet` (Pera).
- All chain access via serverless `/api/*`; no browser secrets.
- TestNet by default; LocalNet reserved for SDK tests.

**Key Docs**
- Game design: `frontend/docs/trust-game-design.md`
- Variants: `frontend/docs/trust-game-variants.md`
- Manual smoke test: `tests/manual/SMOKE.md`

**Explorer**
- LoRA (TestNet): `https://lora.algokit.io/testnet`

## Getting Started

- Install: `npm i`
- Configure: copy `.env.example` to `.env.local` and adjust as needed.
- Run: `npm run dev` (Vite dev server on port 5173)

Environment variables (client): `frontend/.env.example`
- `VITE_NETWORK` (TESTNET|MAINNET) → UI/explorer defaults
- `VITE_TESTNET_ALGOD_URL`, `VITE_TESTNET_INDEXER_URL` (for links only)
- `VITE_TESTNET_APP_ID` (optional default App ID)

Server env (functions): set in Vercel project
- `TESTNET_ALGOD_URL`, `TESTNET_ALGOD_TOKEN` (required)
- `TESTNET_INDEXER_URL`, `TESTNET_INDEXER_TOKEN` (optional)

## Build & Deploy

- Build: `npm run build` → `frontend/dist`
- Vercel settings
  - Root Directory: `frontend/`
  - Build Command: `npm run build`
  - Output: `dist`

## UI Overview

**Admin – Deploy & Manage Pair**
- Deploy: compiles TEAL (`frontend/src/teal/*.teal`) and creates the app.
- Phase controls: set phase 0..3; shows current phase; view pair state.
- Sweep: transfers liquid balance (balance − min) to creator (phase 3 on‑chain).
- View history: fetches indexer summaries and links to LoRA.
- Delete app: creator‑only; enabled at phase 3 (contract‑guarded).

**Subject – Invest**
- App ID selection + globals/local readbacks.
- Invest flow: grouped payment of `s` to app, then AppCall.
- Invest inner payment: refund to S1 of `E1 − s`.

**Subject – Return**
- Shows `t = m × s` and constants.
- Return flow: pays `r` to S1 and `(t − r + E2)` to S2 as inner payments.

## Game Phases & Funding

- Phase 0 (Registration): S1/S2 opt‑in; app records `s1` and `s2`.
- Phase 1 (Invest): S1 invests `s` (UNIT‑aligned, `s ≤ E1`).
  - App inner payment: `E1 − s` refunded to S1.
  - App sets `t = m × s`, advances to phase 2.
  - Funding before Invest: app liquid ≥ `E1 − s` (to refund S1).
- Phase 2 (Return): S2 returns `r` (`0 ≤ r ≤ t`, UNIT‑aligned).
  - Inner payments: `r → S1`, `(t − r + E2) → S2`.
  - Funding before Return: app liquid ≥ `t + E2`.
- Phase 3 (Done): optional Sweep; Delete possible (creator‑only).

Minimum balance note: app must retain ≥ 0.1 ALGO. Sweep moves only liquid; the 0.1 ALGO base remains even after delete.

## Serverless API (Selected)

- `/api/params`: SuggestedParams proxy (Algod)
- `/api/submit`: Submit signed transaction(s) (Algod)
- `/api/pending?txid=...`: Pending info by txid (Algod)
- `/api/pair?id=APP_ID`: App globals (Algod)
- `/api/account?addr=ADDRESS`: Account balance (Algod)
- `/api/compile`: TEAL compile (Algod)
- `/api/history?id=APP_ID`: AppCall history with inner payments (Indexer)
- `/api/export?appId=APP_ID`: CSV export (Indexer)

See `frontend/api/*` for implementation details.

## Troubleshooting

- Invest rejected with UNIT or bounds: ensure `s` is an integer multiple of `UNIT` and `s ≤ E1`.
- Return rejected due to funding: app liquid must be ≥ `t + E2` (check funding in Admin).
- Missing S2 at Return: use a second wallet to opt‑in as S2; the contract asserts existence.
- History labels look odd: the viewer now filters logs to printable ASCII and falls back to generic labels.

## References

- TEAL programs: `frontend/src/teal/approval.teal`, `frontend/src/teal/clear.teal`
- Client tx helpers: `frontend/src/chain/tx.ts`
- Subject UI: `frontend/src/components/SubjectActions.tsx`
- Admin UI: `frontend/src/components/AdminSetup2.tsx`
- Manual smoke test: `tests/manual/SMOKE.md`

For deeper design details and variants, see `frontend/docs/trust-game-design.md` and `frontend/docs/trust-game-variants.md`.

