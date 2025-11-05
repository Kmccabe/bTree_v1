# bTree v1 Frontend (Vercel Ready)

This package is the TestNet web client for **bTree v1**, a decentralized platform for running experimental-economics games on the Algorand blockchain. The app uses **React, Vite, and TypeScript** with direct Indexer access and Algorand wallet integrations to deliver reproducible Trust Game sessions and other experiment variants.

---

## Highlights

- React + TypeScript + Vite with wallet connectivity via [`@txnlab/use-wallet`](https://github.com/TxnLab/use-wallet) (Pera-first flow).
- Modular experiment features under `src/features` (Trust Game today; Dictator, Public Goods, Risk experiments planned).
- Direct Indexer access from the browser; optional API stubs live in `api/` with a disabled copy in `api_disabled/`.
- Built-in registration guards (`RequireWallet`, `RequireRegistration`) and a `NetworkBanner` that warns on TestNet/MainNet mismatches.
- Default target is Algorand TestNet; LocalNet is reserved for SDK and contract testing.

---

## Prerequisites

- Node.js **22.x** and npm
- A Pera-compatible wallet (desktop or mobile) for local testing
- Optional: Python 3.10+ and AlgoKit CLI if you plan to work with contracts locally

---

## Key Docs

- Example experiment design: [`frontend/docs/trust-game-design.md`](frontend/docs/trust-game-design.md)
- Additional variants: [`frontend/docs/trust-game-variants.md`](frontend/docs/trust-game-variants.md)
- Manual smoke checklist: [`tests/manual/SMOKE.md`](../tests/manual/SMOKE.md)
- Repo-wide overview: [`../README.md`](../README.md)

Explorer: [LoRA TestNet](https://lora.algokit.io/testnet)

---

## Getting Started

```bash
cd frontend
npm install
cp .env.example .env        # update values listed below
npm run dev                 # starts Vite on http://localhost:5173
```

> Tip: use `npm run dev -- --host` to test on mobile devices.

---

## Environment Variables

Client-facing values live in `frontend/.env` (copied from `.env.example`):

| Variable              | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `VITE_NETWORK`        | Target network label: `TestNet` (default) or `MainNet`                      |
| `VITE_REGISTRY_APP_ID`| Registry application ID used for auto-routing and subject checks            |
| `VITE_INDEXER_URL`    | Base URL of the Algorand Indexer the UI should read from                    |
| `VITE_INDEXER_TOKEN`  | Optional API key header for the Indexer (leave blank for public endpoints)  |
| `VITE_TESTNET_ALGOD_URL` | Used for explorer and help links; does not gate wallet connectivity      |
| `VITE_TESTNET_ALGOD_TOKEN` | Optional helper token for the above                                    |
| `VITE_TESTNET_INDEXER_URL` | Optional helper URL for docs/explorer references                       |

Server-side (only when deploying behind Vercel functions):

| Variable                    | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `TESTNET_ALGOD_URL`         | Private Algod endpoint (optional)                        |
| `TESTNET_ALGOD_TOKEN`       | Token for the Algod endpoint                             |
| `TESTNET_INDEXER_URL`       | Private Indexer endpoint (optional)                      |
| `TESTNET_INDEXER_TOKEN`     | Token for the private Indexer                            |

---

## Testing & Validation

All commands run from `frontend/`:

- Static type checks: `npm run typecheck`
- Unit tests (Vitest + React Testing Library): `npm test`
- Manual smoke test (Trust Game): follow [`../tests/manual/SMOKE.md`](../tests/manual/SMOKE.md)

Vitest utilities live in `src/test/` with JSDOM setup defined in `vitest.config.ts`.

---

## Build & Deploy

- Production build: `npm run build` (outputs to `dist/`)
- Preview build: `npm run preview`
- Vercel configuration:
  - Root directory: `frontend/`
  - Build command: `npm run build`
  - Output directory: `dist`

---

## Wallet & Routing Behavior

- The landing page watches wallet events via `useSubjectRouter`. When a wallet connects:
  - Registered subjects are redirected to `/subject`.
  - Unregistered subjects are sent to `/register`.
- `RequireWallet` gate keeps subject/admin routes until a wallet connects.
- `RequireRegistration` confirms active accounts are registered before loading the subject dashboard.
- `NetworkBanner` shows when the connected wallet network disagrees with `VITE_NETWORK`.

---

## UI Overview

### Experimenter (deploy & manage)

- Deploys registry-backed experiment contracts (see `src/teal` and contract scripts).
- Manages experiment phases, funding, and sweeps.
- Views participant status through Indexer reads and LoRA explorer links.

### Subject (participate)

- Connects a wallet, passes registry checks, and interacts with the experiment UI (`src/components/SubjectActions.tsx` and `src/features/subject`).
- Reads global/local state for transparency and executes Invest/Return actions or other experiment-specific flows.

---

## Example: Trust Game Phases

| Phase | Summary                                                                               |
| ----- | ------------------------------------------------------------------------------------- |
| 0 – Registration | S1 and S2 opt in; the app records addresses.                              |
| 1 – Invest       | S1 invests `s` (bounded by endowment `E1`); contract calculates multiplier |
| 2 – Return       | S2 returns `r` within allowed range; payouts distribute automatically      |
| 3 – Done         | Creator can sweep liquid funds; deletion allowed when balances settle      |

Minimum balance note: keep at least 0.1 ALGO on the app to avoid minimum-balance penalties.

---

## Blockchain Access

The frontend submits all Algorand transactions through the user's wallet (Pera) using `@txnlab/use-wallet`. Reads are performed directly against the configured Indexer URL, so no middleware is required for TestNet scenarios. If you need private infrastructure, re-enable the API routes located in `api/` and provide the server-side environment variables above.

---

## Troubleshooting Tips

- **Invest rejected**: ensure the stake is a multiple of the UNIT and does not exceed the S1 endowment.
- **Return rejected**: double-check that the contract retains enough liquid balance (multiplier funds plus E2).
- **No S2 address**: connect a second wallet and opt in as the receiver before moving to Phase 2.
- **Unexpected history labels**: explorer views fall back to generic labels when event names are unknown.

---

## Adding New Experiments

Each experiment follows the same pattern:

1. Smart contract (TEAL or PyTeal) compiled to Algorand – see `contracts/registry` and `src/teal/`.
2. Frontend feature module under `src/features/<experiment>` plus UI components.
3. Documentation stored in `frontend/docs/<experiment>-design.md`.

Shared wallet, routing, and notification utilities allow rapid reuse across experiments.

---

## License & Credits

Developed by the **bTree Project** team to advance reproducible, on-chain experimental economics.  
© 2025 bTree Labs — All rights reserved.

