## Summary
Describe what this PR changes and why.

## Links
- Preview deployment URL:
- Related issue (optional):

## Pre-merge checklist (V2 safety)
- [ ] **Branch:** Base is `website-redesign-clean` (V2)
- [ ] **Build:** Vercel preview build is **Ready** (no errors)
- [ ] **Status page:** Renders without errors on preview
- [ ] **Health check:** `/api/health` returns 200 + expected JSON on preview
- [ ] **Env vars:** Required vars present for this change (ALGOD/INDEXER, `VITE_CLASSIC_URL`, etc.)
- [ ] **Root Directory:** Still `frontend` (no accidental change)
- [ ] **Cron:** No sub-daily crons added (Hobby plan) — use daily or remove
- [ ] **Imports/TS:** No Node16 extension issues; keep `moduleResolution: bundler` in `frontend/tsconfig.json`
- [ ] **Docs:** Updated README or comments if behavior/flags changed

## Post-merge (maintainer)
- [ ] Promote the preview to **Production** for V2 domain (or assign alias)
- [ ] (Optional) Tag a stable point: `stable/v2-YYYYMMDD`
