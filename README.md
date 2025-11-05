# bTree v1 – Blockchain Experimental Economics Platform

bTree v1 is an on-chain research stack for human-subject experiments. Smart contracts on Algorand handle registration, payouts, and data integrity so researchers can run reproducible games such as Trust, Dictator, and Public Goods while extending the framework for new experiments.

## Repository Structure

```
bTree_v1/
├─ frontend/
│  ├─ src/            # React app, routing, wallet hooks, components
│  ├─ src/test/       # Vitest configuration and RTL utilities
│  ├─ public/         # Static assets served by Vite
│  ├─ docs/           # Product/UX documentation (e.g., Trust Game design)
│  ├─ api/            # Vercel serverless endpoints (current build)
│  └─ api_disabled/   # Archived API routes kept for reference
├─ contracts/
│  ├─ registry/       # PyTeal source, ABI, deployment helpers, pytest suites
│  └─ artifacts/      # Compiled TEAL, ABI, and deployment outputs
├─ scripts/           # CLI helpers (deploy registry, fees, QR codes, funding)
├─ docs/              # Architecture notes, research background, diagrams
├─ tests/             # Python pytest suites targeting compiled contracts
├─ infra/             # Infrastructure and deployment configuration
└─ archive/           # Legacy experiments, prototypes, historical assets
```

Root files of note: `requirements-dev.txt` (Python tooling), `package.json` (shared Node scripts), `CHANGELOG.md`, `status.md`.

## Tooling Prerequisites

- Node.js 22.x and npm (Vite, TypeScript, Vitest)
- Python 3.10+ with pip (PyTeal toolchain, pytest)
- AlgoKit CLI (Algorand project scaffolding and deployment)
- Git, curl (for cloning and fetching dependencies)

## Setup / Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/<org>/bTree_v1.git
   cd bTree_v1
   ```
2. Install frontend dependencies and start Vite:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Configure environment variables for the frontend:
   ```bash
   cp frontend/.env.example frontend/.env
   ```
   Required keys (strings):
   - `VITE_REGISTRY_APP_ID`
   - `VITE_INDEXER_URL`
   - `VITE_INDEXER_TOKEN` (empty string if unused)
   - `VITE_NETWORK` (`TestNet` or `MainNet`)

## Testing & Validation

- TypeScript project checks: `npm run typecheck` (inside `frontend/`)
- Frontend unit tests (Vitest + React Testing Library): `npm test`
- Contract tests: from repo root run `pip install -r requirements-dev.txt` then `pytest tests`

## Frontend Behavior Highlights

- Wallet flow uses `@txnlab/use-wallet` with Pera as the default provider.
- `RequireWallet` and `RequireRegistration` guards enforce wallet connection and registry enrollment, redirecting to `/register` as needed.
- `useSubjectRouter` auto-routes home-page connections to `/subject` (registered) or `/register` (not registered).
- `NetworkBanner` warns when the connected wallet network differs from the configured `VITE_NETWORK`.

## Contracts & Scripts

- PyTeal smart contracts reside in `contracts/registry` with AlgoKit deployment helpers and ABI definitions.
- Compiled TEAL/ABI artifacts output to `contracts/artifacts`.
- Operational scripts in `scripts/` manage registry deployment, fee tuning, funding, and QR generation. Install dependencies via `pip install -r requirements-dev.txt`.

## Docs & Links

- Frontend guide: [`frontend/README.md`](frontend/README.md)
- Trust Game design notes: [`frontend/docs/trust-game-design.md`](frontend/docs/trust-game-design.md)
- Smart contracts: [`contracts/`](contracts/)
- Additional references: [`docs/`](docs/)

## License & Credits

© 2025 bTree Labs — All rights reserved.

