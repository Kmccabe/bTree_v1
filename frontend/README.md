
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
- Add the `VITE_TESTNET_*` env vars in Vercel project settings.
- Deploy.
