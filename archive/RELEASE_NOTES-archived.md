Release Notes — Phase 1: Kick‑off (Aug 29)

Summary
- Initial scaffold for the Trust Game experiment on Algorand is complete. Pera wallet connection on TestNet works and a minimal application can be deployed via the frontend. LocalNet is available for SDK and CI tests.

What’s New
- Repository scaffold: `contracts/`, `frontend/`, `scripts/`, `tests/`, `infra/`.
- Frontend (React + Vite + TypeScript) with Pera Wallet (TestNet) connect and a placeholder app‑deploy flow.
- Vercel serverless endpoints for Algod access: `frontend/api/{params,compile,submit,pending}.ts` with `_algod.ts` env handling.
- Environment example: `frontend/.env.example` covering TestNet + LocalNet.
- AlgoKit/LocalNet notes: `infra/ALGOKIT.md`.
- Tests: placeholder + LocalNet health checks in `tests/`.
- Documentation: Updated `README.md` with Runbook and `CHECKLIST.md` marked complete for Aug 29.

Implemented Scope
- Connect Pera (TestNet) and deploy a placeholder application (App ID surfaced in UI).
- Compile TEAL in serverless, build app‑create transaction client‑side, sign via Pera, submit via serverless.
- Basic debug info (suggested params, program lengths, links to Indexer/Lora).

Limitations
- Smart contract in `contracts/trust_game_app.py` is a skeleton (no business logic yet).
- Registration, pairing, commit/reveal, settlement, CSV export, and digest are not implemented yet (see checklist).
- LocalNet is intended for SDK/CI only; wallet UX targets TestNet.

Setup / Upgrade Notes
- Pera: Enable Developer Mode → TestNet and fund wallet from the TestNet dispenser.
- Env: Copy `frontend/.env.example` to `frontend/.env.local` and set `TESTNET_ALGOD_URL` and optional `TESTNET_ALGOD_TOKEN`.
- Local dev: run `vercel dev` (serverless on :3000) and `npm run dev` (Vite with proxy to `/api`).

Verification
- Connect Pera in the app, click “Deploy to TestNet”, then confirm TxID and App ID. Links to Indexer JSON and Lora are provided for verification.
- For LocalNet checks, start `algokit localnet start` and run `pytest` to verify health endpoints.

Known Issues
- If `/api/*` calls fail in local dev, ensure `vercel dev` is running so Vite can proxy those routes.
- Invalid address warnings appear if the wallet session is stale; reconnect Pera to refresh.

Next Milestones (per CHECKLIST)
- Contract scaffold and deployment (LocalNet/TestNet).
- Registration + uniqueness, experimenter pairing and role display.
- Commit/reveal implementation and validation.
- Settlement math and optional inner payments.
- CSV exporter and final digest verification.
- End‑to‑end UX, tests, and CI pipeline.

Tag Suggestion
- v0.1.0-kickoff

