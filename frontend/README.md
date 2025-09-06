
# Frontend (Vercel‑ready)

- React + Vite + TypeScript
- Wallet via `@txnlab/use-wallet` v2 (Pera provider)
- Defaults to TESTNET; LocalNet is for SDK/CI only
- All chain I/O via serverless `/api/*` (no direct Algod from browser)

## Dev
```bash
npm i
cp .env.example .env.local
npm run dev
```

## Vercel
- Set server envs (Functions): `TESTNET_ALGOD_URL`, `TESTNET_ALGOD_TOKEN`.
- Optionally set client envs: `VITE_NETWORK=TESTNET` (defaults to TESTNET).
- Root Directory: `frontend/`; `npm run build`; output `dist`.

## Local Dev Tips
- Run `npx vercel dev` in parallel (exposes `/api` on :3000).
- Vite dev proxies `/api` to :3000 (see `vite.config.ts`).

## Docs

- Design spec: [docs/trust-game-design.md](docs/trust-game-design.md)
- Variants & treatments: [docs/trust-game-variants.md](docs/trust-game-variants.md)

## usage
## 🛠️ Admin Controls

After phase 3 (Done), the admin has several tools available:

- **View history** – Displays a chronological log of all actions (opt-ins, invest, return, sweep) with timestamps, actors, and amounts. Data is pulled directly from LoRA for auditability.  
- **Sweep** – Transfers any remaining funds in the app back to the creator’s wallet. Only available once the game is finished.  
- **Delete app** – Permanently deletes the application from chain. Enabled only at phase 3 to prevent accidental deletion mid-game.  

These controls provide a complete lifecycle: deploy → run experiment → review history → reclaim funds → clean up.

