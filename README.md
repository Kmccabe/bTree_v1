
# Trust Game Experiment App (Algorand, Pera/TestNet) — MVP Scaffold

This repo is a **starter scaffold** for the September 9 deadline plan. 
- **Wallet flows:** Pera on **TestNet**
- **LocalNet:** for SDK/CI tests only
- **Hosting:** Frontend on **Vercel** (optional: exporter microservice on Railway later)

## Structure
```
contracts/        # Algorand Python (algopy/PyTeal) contract skeletons
frontend/         # React + Vite + TypeScript app (Pera on TestNet)
scripts/          # Exporter & verification scripts (placeholders)
tests/            # Unit & scenario tests (placeholders)
infra/            # Notes and configs (AlgoKit, CI pointers)
CHECKLIST.md      # Day-by-day checklist to Sept 9
```

## Quick Start (Day 1)
1. **LocalNet (SDK only)**
   ```bash
   # Requires Docker + AlgoKit
   algokit localnet start
   ```

2. **Pera on TestNet**
   - In the Pera app → Settings → *Developer Mode* → **TestNet**
   - Fund your account from the TestNet dispenser

3. **Frontend (local)**
   ```bash
   cd frontend
   npm i
   cp .env.example .env.local
   # Fill TESTNET_* endpoints
   npm run dev
   ```

4. **Vercel**
   - Connect `frontend/` to Vercel
   - Add env vars from `.env.example` (use the TESTNET_* ones)
   - Deploy

## Notes
- This scaffold includes *placeholders* only. Contract methods are stubbed.
- Exporter is a placeholder until Sept 4 milestone.
- See `CHECKLIST.md` for daily acceptance gates.


## CI
Add this badge after first push:

```
![CI](https://github.com/<your-org>/<your-repo>/actions/workflows/ci.yml/badge.svg)
```
