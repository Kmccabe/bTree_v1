# bTree v1 - Trust Game MVP (Algorand + Pera/TestNet)

Minimal, production-oriented scaffold for running a Trust Game on Algorand TestNet.
The app is built with React + Vite, uses Pera Wallet for signing, and deploys on
Vercel with serverless routes that proxy Algod.

- Wallet: Pera (TestNet; no mnemonics in-browser)
- Chain access: Vercel serverless functions -> Algod
- Hosting: Vercel (Root Directory = `frontend/`)
- Contracts: Placeholder TEAL for now; upgradeable to full Trust Game logic

## Trust Game (MVP)

- Design spec: frontend/docs/trust-game-design.md
- Variants & treatments: frontend/docs/trust-game-variants.md
- Testing checklist (Phase 2): frontend/docs/phase-2-testing.md

Quick note: The app lives under `frontend/` (React + Vite + Vercel serverless).
Admin can deploy & fund a per-pair contract from the in-app "Admin - Deploy & Fund" panel.

## Quick Start

Local (with serverless APIs):

1) Install deps
   - cd frontend
   - npm install

2) Create `frontend/.env` for serverless routes (Algonode needs no token)
   - TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud
   - TESTNET_ALGOD_TOKEN=

3) Run serverless and UI in two terminals
   - Terminal A (serverless): npx vercel dev
   - Terminal B (Vite UI): npm run dev

4) Open http://localhost:5173, connect Pera (TestNet), click Deploy, then use Phase Control.

Deploy to Vercel (summary):
- Root Directory: `frontend/`
- Build Command: `npm run build`
- Output Directory: `dist`
- Env vars: set TESTNET_ALGOD_URL/TESTNET_ALGOD_TOKEN (serverless) and optional VITE_* (client)

## Project Structure

contracts/
frontend/
  api/ (serverless routes)
  public/
  src/
    App.tsx
    main.tsx
    deploy.ts
    components/PhaseControl.tsx
    components/SubjectActions.tsx
    polyfills.ts

## Environment Variables

Serverless (used by `/api/*`, secure):
- TESTNET_ALGOD_URL = https://testnet-api.algonode.cloud
- TESTNET_ALGOD_TOKEN = (blank for Algonode, or your provider key)

Client (Vite build-time):
- VITE_NETWORK = TESTNET
- VITE_TESTNET_APP_ID = (optional; known app id)
- VITE_TESTNET_ALGOD_URL = https://testnet-api.algonode.cloud
- VITE_TESTNET_INDEXER_URL = https://testnet-idx.algonode.cloud

Local serverless (`vercel dev`):
- Put the same TESTNET_ALGOD_* values in `frontend/.env`

## Quick Demo (single account)

Run the end-to-end Phase 2 flow with one wallet (TestNet):

1) Connect Wallet (TestNet)
2) Deploy contract (or use an existing App ID)
3) Fund contract (App Address). For a full demo in one pass, the app needs at least t = 3 x s microAlgos after Invest (UI shows low-balance hints; baseline ~0.20 ALGO)
4) Set App ID in the Subject panel and click Load globals
5) Opt-In in the Subject panel (ignore "already opted in" if shown)
6) In Quick Demo, enter:
   - s (microAlgos): multiple of UNIT and <= E (e.g., 40000 if UNIT=1000)
   - r (microAlgos): 0..t and multiple of UNIT (t becomes 3 x s after Invest)
7) Click Run Demo: [set phase=2 if creator] -> Opt-In -> Invest -> Read Pair States -> check funding -> Return
   - If underfunded for Return, fund the App Address and use Run Return only
8) View results: Invest and Return show "View on LoRA" links (lora.algokit.io/testnet/tx/<txid>)

## Troubleshooting

- Wallet on wrong network: ensure wallet network matches VITE_NETWORK (TestNet)
- /api/* 404 locally: run `npx vercel dev` alongside `npm run dev`
- Pending not found: wait a round or two; click Load globals/Read pair states again

