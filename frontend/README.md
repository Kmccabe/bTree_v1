
# Frontend (Vercel-ready)

- React + Vite + TypeScript
- **Pera Wallet** via `@perawallet/connect`
- Defaults to **TESTNET**; LocalNet is for SDK/CI only

## Dev
```bash
npm i
cp .env.example .env.local
npm run dev
```

## Vercel
- Set server envs (Functions): `TESTNET_ALGOD_URL`, `TESTNET_ALGOD_TOKEN`.
- Optionally set client envs: `VITE_NETWORK=TESTNET` (defaults to TESTNET).
- Deploy.
