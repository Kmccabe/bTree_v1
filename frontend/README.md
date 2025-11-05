# bTree v1 Frontend (Vercel-Ready)

This is the TestNet web client for **bTree v1**, a decentralized platform for running
economic and behavioral experiments on the Algorand blockchain.

The frontend is built with **React + Vite + TypeScript** and communicates directly with
Algorand nodes using public Indexer endpoints.
It currently includes a complete **Trust Game** implementation as an example experiment.

Future experiments (e.g., Dictator, Public Goods, or Risk Preference tasks) will reuse
the same wallet logic, routing, and shared components.

---

## Highlights

* React + TypeScript + Vite; wallet integration via [`@txnlab/use-wallet`](https://github.com/TxnLab/use-wallet) (Pera).
* Modular experiment templates (Trust Game, Dictator, etc.).
* Direct Indexer access — no serverless API routes required.
* TestNet by default; LocalNet reserved for SDK tests.

---

## Key Docs

* **Example experiment:** [`frontend/docs/trust-game-design.md`](frontend/docs/trust-game-design.md)
* **Variants:** [`frontend/docs/trust-game-variants.md`](frontend/docs/trust-game-variants.md)
* **Manual smoke test:** [`tests/manual/SMOKE.md`](tests/manual/SMOKE.md)

**Explorer:**

* LoRA (TestNet): [https://lora.algokit.io/testnet](https://lora.algokit.io/testnet)

---

## Getting Started

```bash
npm install
cp .env.example .env.local  # then edit as needed
npm run dev                 # Vite dev server on port 5173
```

### Environment Variables

Client-side (`frontend/.env.example`):

| Variable                                             | Description                                           |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `VITE_NETWORK`                                       | `TESTNET` or `MAINNET`; controls UI/explorer defaults |
| `VITE_TESTNET_ALGOD_URL`, `VITE_TESTNET_INDEXER_URL` | Explorer links only                                   |
| `VITE_TESTNET_APP_ID`                                | Optional default App ID for quick connect             |

Server-side (Vercel project settings, **optional**):

| Variable                                       | Description                       |
| ---------------------------------------------- | --------------------------------- |
| `TESTNET_ALGOD_URL`, `TESTNET_ALGOD_TOKEN`     | Only needed if using private node |
| `TESTNET_INDEXER_URL`, `TESTNET_INDEXER_TOKEN` | Optional (Indexer lookups)        |

---

## Build & Deploy

* **Build:** `npm run build` → outputs to `frontend/dist`
* **Vercel settings:**

  * Root Directory: `frontend/`
  * Build Command: `npm run build`
  * Output Directory: `dist`

---

## UI Overview

### Experimenter – Deploy & Manage Experiments

* Deploys a contract app (TEAL compiled from `frontend/src/teal/*.teal`).
* Controls experimental phases (0–3).
* Views current phase and participant state.
* Performs **Sweep** (withdraws liquid balance in Phase 3).
* Views historical data via Indexer and LoRA explorer.
* Can delete app after completion (contract-guarded).

### Subject – Participate

* Connects wallet and selects an experiment instance (App ID).
* Reads global/local state for transparency.
* Executes Invest/Return or equivalent actions depending on experiment design.

---

## Example: Trust Game Phases & Funding

*(Other experiments will define their own analogous flow.)*

| Phase                | Description                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **0 – Registration** | S1/S2 opt-in; app records `s1` and `s2`.                                                                        |
| **1 – Invest**       | S1 invests `s` (UNIT-aligned, `s ≤ E1`). App refunds `E1 − s` to S1, sets `t = m × s`, and advances to Phase 2. |
| **2 – Return**       | S2 returns `r` (`0 ≤ r ≤ t`). Inner payments: `r → S1`, `(t − r + E2) → S2`.                                    |
| **3 – Done**         | Optional Sweep; Delete possible (creator-only).                                                                 |

Minimum balance: app must always retain ≥ 0.1 ALGO. Sweep moves only liquid balance.

---

## Blockchain Access

All Algorand node and indexer requests are made directly from the browser using
**public endpoints** (e.g., [Algonode](https://algonode.io)).
Signed transactions are submitted securely through the user’s wallet (Pera) via
`@txnlab/use-wallet`.

No serverless API routes are required for local or TestNet deployments.

For self-hosting with private Algod tokens, developers can re-enable the legacy
`/api/*` proxy routes from earlier versions (see archived branch `serverless-proxy`).

---

## Troubleshooting (Trust Game Example)

* **Invest rejected (UNIT or bounds):** ensure `s` is a multiple of `UNIT` and `s ≤ E1`.
* **Return rejected (funding):** app liquid ≥ `t + E2`.
* **Missing S2:** use a second wallet to opt-in as S2.
* **History labels look odd:** viewer filters logs to printable ASCII; generic labels appear if unrecognized.

---

## References

### Example: Trust Game Implementation

* TEAL programs: `frontend/src/teal/approval.teal`, `frontend/src/teal/clear.teal`
* Client tx helpers: `frontend/src/chain/tx.ts`
* Subject UI: `frontend/src/components/SubjectActions.tsx`
* Admin UI: `frontend/src/components/AdminSetup2.tsx`
* Manual smoke test: `tests/manual/SMOKE.md`

For additional experiment templates, see `frontend/src/features/` and related docs under `frontend/docs/`.

---

## Adding New Experiments

Each experiment consists of:

1. **Smart contract:** `src/teal/<experiment>.teal`
2. **Frontend logic:** `src/features/<experiment>`
3. **Documentation:** `frontend/docs/<experiment>-design.md`

The platform handles wallet connection, registry checks, and on-chain communication
uniformly across all experiments.

---

### License & Credits

Developed by the **bTree Project** team to advance reproducible, on-chain experimental economics.
© 2025 bTree Labs — All rights reserved.
