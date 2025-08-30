# bTree v1 — Trust Game Experiment (Algorand + Pera/TestNet)

End-to-end scaffold for a Trust Game experiment on Algorand. Wallet flows run on Pera Wallet (TestNet). LocalNet is used for SDK- and CI-driven tests. The frontend is designed to deploy on Vercel with simple serverless helpers for Algod access.

- Wallet: Pera on TestNet (no mnemonics in-browser)
- Networks: TestNet for users; LocalNet for tests/CI
- Hosting: Vercel for `frontend/` (serverless `/api/*`) 

## Current Status
- Aug 29 (Kick‑off) checklist complete. See `CHECKLIST.md` for the remaining schedule to Sept 9.
- Contracts are placeholders; the UI can connect Pera and deploy a minimal app to TestNet via serverless APIs.

## Repository Structure
```
contracts/        # Algorand Python (algopy/PyTeal) contract skeletons
frontend/         # React + Vite + TypeScript app with Pera (TestNet)
  ├─ api/         # Vercel serverless endpoints (Algod proxy, compile, submit)
  └─ src/         # Client app (Pera connect, deploy placeholder app)
infra/            # AlgoKit + LocalNet notes
scripts/          # Export/verification scripts (placeholders)
tests/            # pytest tests (LocalNet health, placeholders)
CHECKLIST.md      # Day-by-day plan to Sept 9
CLAUDE.md         # Architecture and dev guide (more detail)
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
