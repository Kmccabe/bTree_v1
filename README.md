# bTree v1 — Trust Game MVP (Algorand + Pera/TestNet)

Minimal, production‑oriented scaffold for running a Trust Game on Algorand TestNet. The app is built with React + Vite, uses Pera Wallet for signing, and deploys on Vercel with serverless routes that proxy Algod.

- Wallet: Pera (TestNet; no mnemonics in‑browser)
- Chain access: Vercel serverless functions → Algod
- Hosting: Vercel (Root Directory = `frontend/`)
- Contracts: Placeholder TEAL for now; upgradeable to full Trust Game logic

---

## Update: Wallet Integration (use-wallet v2)

The frontend now uses `@txnlab/use-wallet` v2 with the Pera provider and UI improvements:

- Provider init lives in `frontend/src/main.tsx` using `useInitializeProviders` and `<WalletProvider>`.
- No forced chainId; make sure Pera’s network matches `VITE_NETWORK`.
- Optional auto‑restore on load via `VITE_WALLET_AUTO_RECONNECT=true` (default: disabled).
- Account selector appears when multiple accounts are available (`frontend/src/components/AccountSelector.tsx`).
- Non‑blocking toasts replace browser alerts (`frontend/src/components/Toaster.tsx`).
- The Debug Panel includes “Force Reconnect” and “Reset Wallet Session” actions for recovery.

Note: This supersedes earlier mentions of a shared `src/wallet.ts` Pera instance; the app now relies on `@txnlab/use-wallet` hooks and provider.

---

## Quick Start

Local (with serverless APIs):

1) Install deps
```
cd frontend
npm install
```

2) Create `frontend/.env` for serverless routes (Algonode needs no token)
```
TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud
TESTNET_ALGOD_TOKEN=
```

3) Run serverless and UI in two terminals
```
# Terminal A (serverless):
npx vercel dev

# Terminal B (Vite UI):
npm run dev
```

4) Open http://localhost:5173, connect Pera (TestNet), click Deploy, then use Phase Control.

Deploy to Vercel (summary):

- Root Directory: `frontend/`
- Build Command: `npm run build`
- Output Directory: `dist`
- Env vars: set TESTNET_ALGOD_URL/TESTNET_ALGOD_TOKEN (serverless) and optional VITE_* (client)

---

## Project Structure

```
contracts/                      # PyTeal scaffold + build script (optional now)
  build.py
  requirements.txt
frontend/                       # React + Vite + TypeScript app (Pera on TestNet)
  api/                          # Serverless routes (Algod proxy)
    _algod.ts                   # URL + headers helper
    params.ts                   # GET  /api/params
    compile.ts                  # POST /api/compile
    submit.ts                   # POST /api/submit
    pending.ts                  # GET  /api/pending?txid=...
  public/
    favicon.svg
  src/
    App.tsx                     # Pera connect, deploy, debug panel
    main.tsx                    # use-wallet v2 provider initialization
    deploy.ts                   # Build unsigned app-create txn (wallet signs)
    components/PhaseControl.tsx # Admin phase switching via app call
    polyfills.ts                # Buffer/process/global shims for browser
  index.html
  package.json
```

---

## Prerequisites

- Node.js 18+ and npm
- Vercel CLI (optional, for local serverless): `npm i -g vercel`
- Pera Wallet (Developer Mode + TestNet enabled, funded TestNet account)

Optional (for contracts/tests):
- Python 3.10+
- Docker + AlgoKit for LocalNet

---

## Environment Variables

Set these in Vercel → Project → Settings → Environment Variables for Production/Preview/Development (serverless), and in `frontend/.env.local` for local client build.

Serverless (used by `/api/*`, stored securely in Vercel):

```
TESTNET_ALGOD_URL   = https://testnet-api.algonode.cloud
TESTNET_ALGOD_TOKEN =            # blank for Algonode, or your provider key
```

Client (Vite build‑time, safe to expose):

```
VITE_NETWORK              = TESTNET
VITE_TESTNET_APP_ID       =            # optional; shows a known app id
VITE_TESTNET_ALGOD_URL    = https://testnet-api.algonode.cloud
VITE_TESTNET_INDEXER_URL  = https://testnet-idx.algonode.cloud
```

Local serverless (only for `vercel dev`):

```
# frontend/.env
TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud
TESTNET_ALGOD_TOKEN=
```

---

## Local Development

1) Install and run the frontend

```
cd frontend
npm install
npm run dev         # Vite UI at http://localhost:5173
```

2) (Optional) Run serverless API routes locally

```
cd frontend
npx vercel dev      # http://localhost:3000 (includes /api/*)
```

When both are running, Vite proxies `/api/*` to Vercel dev.

---

## Deploying to Vercel

Project settings:

- Root Directory: `frontend/`
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js: 18+
- Environment Variables: set the Serverless and Client values above

First deploy:

1) Push to your Git host and import the repo into Vercel.
2) Confirm the Root Directory and env vars.
3) Deploy and visit the site.

Post‑deploy health checks:

- `https://<your-app>/api/health` → `{ ok: true }`
- `https://<your-app>/api/params` → JSON with `"last-round"`

---

## Using the App

1) Connect Pera Wallet (ensure the wallet is on TestNet).
2) Deploy placeholder app (creates a minimal TEAL app on TestNet via wallet‑signed transaction).
3) Use Phase Control to switch experiment phases (NoOp application calls).

Notes:
- Transactions are built client‑side and signed in Pera; serverless routes only forward the signed bytes to Algod.
- Wallet integration uses `@txnlab/use-wallet` v2; no shared `wallet.ts` singleton. Provider setup lives in `frontend/src/main.tsx`.

---

## Refactor Highlights

- Moved to `@txnlab/use-wallet` v2 (Pera provider) with initialization in `frontend/src/main.tsx`.
- Removed legacy wallet singleton (`src/wallet.ts`) and legacy identity modules.
- Enforced serverless-only chain I/O via `frontend/api/*` (no direct Algod from the browser).
- Clarified env separation: `TESTNET_ALGOD_*` (server) vs `VITE_*` (client).
- Local dev uses `vercel dev` with Vite proxying `/api` to `:3000`.

---

## API Routes

- `GET  /api/health`      – basic health check
- `GET  /api/params`      – fetch Algod suggested params
- `POST /api/compile`     – compile TEAL source
- `POST /api/submit`      – submit a signed transaction (base64)
- `GET  /api/pending`     – pending info for a txid

---

## Implementation Details

- SuggestedParams normalization (SDK v3‑friendly):
  - `fee`/`minFee` (≥ 1000), `flatFee: true`
  - `firstValid`/`lastValid` and `firstRound`/`lastRound` aliases
  - `genesisID` and base64‑decoded `genesisHash`
- Polyfills for browser builds (`Buffer`, `process`, `global`) are provided in `src/polyfills.ts`.
- `frontend/public/favicon.svg` is included; `/favicon.ico` redirects to it via `vercel.json`.

---

## Troubleshooting

- Wallet connection issues:
  - Ensure Pera is on the same network as `VITE_NETWORK` (TestNet by default).
  - Use the Debug Panel actions (Reconnect/Reset) or call `reconnectProviders` via the app to restore sessions.
- Zero‑fee rejection ("txgroup had 0 in fees"):
  - Params are normalized to enforce a non‑zero fee; refresh and retry.
- `/api/*` returns HTML/404 locally:
  - Run `npx vercel dev` alongside `npm run dev` so `/api` is routed.
- Vercel deploys not triggered on push:
  - Set Root Directory = `frontend/`, resync the Git integration, or create a blank commit:
    - `git commit --allow-empty -m "chore: trigger deploy" && git push`

---

## Roadmap

- Replace placeholder TEAL with full Trust Game contract
- Registration, pairing, commit/reveal, settlement flows
- CSV export and integrity digest
- LocalNet + CI test coverage
