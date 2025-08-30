# bTree v1 — Trust Game Experiment (Algorand + Pera/TestNet)

End-to-end scaffold for a Trust Game experiment on Algorand. Wallet flows run on Pera Wallet (TestNet). LocalNet is used for SDK- and CI-driven tests. The frontend is designed to deploy on Vercel with simple serverless helpers for Algod access.

- Wallet: Pera on TestNet (no mnemonics in-browser)
- Networks: TestNet for users; LocalNet for tests/CI
- Hosting: Vercel for `frontend/` (serverless `/api/*`) 

## Current Status
- Aug 29 (Kick‑off) checklist complete. See `CHECKLIST.md` for the remaining schedule to Sept 9.
- Contracts are placeholders; the UI can connect Pera and deploy a minimal app to TestNet via serverless APIs.

Starter scaffold toward the Sept 9 deadline.

- **Wallet flows:** Pera on **TestNet** (wallet signs; no mnemonics on server)
- **LocalNet:** for SDK/CI tests only (AlgoKit)
- **Hosting:** Frontend on **Vercel** (serverless `/api/*` to proxy Algod)

## Repository Structure
```
contracts/                      # PyTeal scaffold + build script → artifacts/*.teal
  trust_game_app_scaffold.py    # current scaffold (keep your trust_game_app.py notes too)
  build.py
  requirements.txt
frontend/                       # React + Vite + TypeScript app (Pera on TestNet)
  api/                          # Vercel serverless routes (Algod proxy)
    params.ts                   # GET /api/params
    compile.ts                  # POST /api/compile
    submit.ts                   # POST /api/submit
    pending.ts                  # GET  /api/pending?txid=...
    _algod.ts                   # shared helper (URL + headers)
  src/
    App.tsx                     # UI (Pera connect, admin-gated deploy, Manifest card)
    deploy.ts                   # builds unsigned app-create txn (Pera signs)
    components/ManifestCard.tsx
tests/
  contract/
    test_build_and_compile.py   # compiles TEAL on LocalNet
    test_happy_path_stub.py     # placeholder, skipped
docs/
  DATA_EXPORT.md                # CSV/export plan
  INTEGRITY.md                  # finalize() digest plan
artifacts/                      # generated TEAL + manifest (via contracts/build.py)
```

## Prerequisites
- Node.js 18+ and npm
- Python 3.10+ and `pip`
- Docker and AlgoKit (for LocalNet)
- Vercel CLI (optional but recommended for local serverless): `npm i -g vercel`
- Pera Wallet (enable TestNet in Developer Mode)

## Environment
Create `frontend/.env.local` from the example and fill the TestNet endpoints/tokens as needed:

```
cp frontend/.env.example frontend/.env.local
```

Key variables (see `frontend/.env.example`):
- Server (Vercel Functions): `TESTNET_ALGOD_URL`, `TESTNET_ALGOD_TOKEN`
- Client (Vite): `VITE_NETWORK=TESTNET`, `VITE_TESTNET_ALGOD_URL`, `VITE_TESTNET_INDEXER_URL`

## Local Development
1) Start LocalNet (optional; used by SDK tests and CI):
```
algokit localnet start
```

2) Start Vercel dev for serverless APIs (`/api/*` on :3000):
```
cd frontend
vercel dev
```

3) Start the Vite dev server in a separate terminal (proxies `/api` to :3000):
```
cd frontend
npm install
npm run dev
```

4) In Pera Wallet: enable Developer Mode → TestNet, and fund your wallet from the TestNet dispenser.

The app lets you connect Pera and deploy a placeholder application. The client compiles simple TEAL via `/api/compile`, builds an app‑create transaction, asks Pera to sign, then submits via `/api/submit`. Pending info (`/api/pending`) is polled to display the resulting App ID.

Relevant code:
- `frontend/src/App.tsx` (Pera connect, deploy flow)
- `frontend/src/deploy.ts` (compile TEAL + build app‑create txn)
- `frontend/api` (serverless: Algod proxy, compile, params, submit)

## Deploy to Vercel
1) Push `frontend/` to a Git repo and import the project in Vercel.
2) Set Project Environment Variables from `frontend/.env.example`:
   - `TESTNET_ALGOD_URL`, `TESTNET_ALGOD_TOKEN`
   - Optional client var: `VITE_NETWORK=TESTNET`
3) Deploy. After deploy, open the site and connect Pera on TestNet.

## Runbook
- Provision: Enable TestNet in Pera (Developer Mode) and fund the wallet from the TestNet dispenser.
- Configure: Create `frontend/.env.local` and set TestNet Algod URL/token; for local dev, run `vercel dev` and `npm run dev` in `frontend/`.
- Deploy (current): In the app, connect Pera and click “Deploy to TestNet”. Record the TxID and App ID shown in the Manifest box. Verify via provided Lora/Indexer JSON links.
- Operate (upcoming): Registration, pairing, commit/reveal, settlement, and CSV export follow the dates in `CHECKLIST.md`. These flows are scaffolded but not yet implemented.
- Verify/Export (upcoming): Use the exporter endpoint to retrieve CSV and compute digest once implemented.
- Local testing: Run `algokit localnet start`, then `pytest` for SDK/health checks.

## Contracts
- Placeholder contract scaffold: `contracts/trust_game_app.py`
- Planned features (per `CLAUDE.md`): registration, pairing, commit/reveal, settlement, event logs, final digest.

## Tests
Install Python dev deps and run pytest:
```
pip install -r requirements-dev.txt
pytest
```
Notes:
- `tests/test_localnet_ports.py` checks LocalNet health; ensure `algokit localnet start` is running before that test.

## Roadmap
- The daily plan with acceptance gates is in `CHECKLIST.md`. Aug 29 is complete; next steps include contract scaffolding, registration/pairing, commit/reveal, settlement, CSV export, digest verification, and end‑to‑end UX.
- `CLAUDE.md` contains an architecture overview and dev workflow that complements this README.

## Troubleshooting
- Pera not connecting or invalid address in UI: re‑enable Developer Mode → TestNet and reconnect.
- `/api/*` 404 in local dev: run `vercel dev` (port 3000) alongside `npm run dev` so Vite can proxy `/api` to serverless.
- Algod/Indexer failures in tests: confirm LocalNet is started (see `infra/ALGOKIT.md`).

## CI
Add a CI badge after pushing to GitHub and enabling Actions:
```
![CI](https://github.com/<your-org>/<your-repo>/actions/workflows/ci.yml/badge.svg)
```
## Environment Variables

### Vercel (serverless functions; `process.env`)
Set in **Project → Settings → Environment Variables** for **Production, Preview, Development**:

~~~
TESTNET_ALGOD_URL = https://testnet-api.algonode.cloud
TESTNET_ALGOD_TOKEN =
~~~

### Vite client (browser; `import.meta.env`)
Create/update **`frontend/.env.local`**:

~~~
VITE_NETWORK=TESTNET
VITE_TESTNET_APP_ID=              # optional; display a known app id
VITE_TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud
VITE_TESTNET_INDEXER_URL=https://testnet-idx.algonode.cloud
VITE_TESTNET_ALGOD_TOKEN=
~~~

### Local serverless (only for `vercel dev`)
Create **`frontend/.env`**:

~~~
TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud
TESTNET_ALGOD_TOKEN=
~~~

---

## Quick Start

### 1) LocalNet (SDK tests)
Requires Docker + AlgoKit:
~~~
algokit localnet start
~~~

### 2) Build contract artifacts
~~~
python -m pip install -r contracts/requirements.txt
python contracts/build.py
# → artifacts/approval.teal, artifacts/clear.teal, artifacts/contract.manifest.json
~~~

### 3) Run tests (compile TEAL against LocalNet)
~~~
python -m pip install requests py-algorand-sdk
pytest -q
~~~

### 4) Frontend (local)
~~~
cd frontend
npm i
npm run dev          # UI at http://localhost:5173 (no /api routes)
# or to run serverless routes locally:
npx vercel dev       # app + /api at http://localhost:3000
~~~

### 5) Vercel (hosting)
- **Root Directory:** `frontend/`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- Add the **server** env vars above; deploy.
- Verify:
  - `https://<app>/api/health` → `{ ok: true }`
  - `https://<app>/api/params` → JSON with `"last-round"`

---

## Using the app

- Click **Connect Pera Wallet** (make sure your Pera app is on **TestNet**).
- **Manifest card** shows network, App ID, TxID (when available), and a **Copy Manifest** button for reproducibility.
- **Admin controls:** add `?admin=1` to the URL to reveal **Deploy to TestNet**.  
  The app-create transaction is built client-side and **signed in Pera**; the serverless route only forwards it to Algod.

---

## CI (GitHub Actions)

Make sure your workflow:
1) Installs contract deps (`pyteal`, `requests`)
2) Runs `python contracts/build.py`
3) Starts LocalNet (Docker-in-Docker)
4) Runs `pytest -q`

Badge:
~~~
![CI](https://github.com/Kmccabe/bTree_v1/actions/workflows/ci.yml/badge.svg)
~~~

---

## Milestones

- **Aug 29**: Frontend + wallet-only deploy; API routes; LocalNet health ✅  
- **Aug 30**: Contract scaffold + artifacts + LocalNet compile test ✅  
- **Aug 31 – Sept 3**: Implement register/commit/reveal/settle + tests  
- **Sept 4 – 6**: Exporter (CSV), integrity digest, docs  
- **Sept 7 – 9**: Polish, walkthrough, dry run

---

## Troubleshooting

- **`Unexpected token '<' ... not valid JSON`** during deploy: you’re hitting Vite preview (no functions). Use the deployed site or `npx vercel dev`.
- **`Cannot find module './_algod'`**: ensure `frontend/api/_algod.ts` exists and imports use the correct relative path.
- **`process` not found in API TS**: `npm i -D @types/node` and add `/// <reference types="node" />` at top of API files.
- **TypeScript types for algosdk params**: we cast `SuggestedParams` to `any` in `deploy.ts` to be compatible across SDK versions.