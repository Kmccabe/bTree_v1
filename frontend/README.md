
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
