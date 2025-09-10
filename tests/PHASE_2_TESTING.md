# Phase 2 Testing Guide (TestNet)

This guide walks you through verifying the current Trust Game app in Phase 2 (Invest/Return) on Algorand TestNet. Each step lists the action, expected effect, and where to observe it (UI, console, or LoRA).

## Prerequisites

- Node.js installed; dependencies installed once with `npm i` at repo root.
- Wallet with a funded TestNet account (Pera/Defly/etc.).
- `frontend/.env.local` configured:
  - `VITE_NETWORK=TESTNET`
  - `VITE_TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud`
  - `TESTNET_ALGOD_URL=https://testnet-api.algonode.cloud`
  - `VITE_TESTNET_APP_ID=<your app id>` (optional; you can also type this in the UI)
- Browser DevTools Console open to view logs.

## Start the App

1) From `frontend/`, run `vercel dev` (preferred to serve both `/` and `/api/*`).
   - Expected: local URL (often `http://localhost:3000`).
   - See: terminal output; app loads in browser.

> Alternative: use your existing setup that serves both the SPA and the serverless `/api/*` endpoints together.

## Connect Wallet

2) Connect your TestNet wallet in the app.
   - Expected (UI): shows `Connected: <your-address> · App Address: <derived-app-address> · UNIT: ... · E: ...`.
   - See: also browser console logs tagged `[appId]` and `[SubjectActions]` when you take actions.

## Set App ID and Load Globals

3) Enter your App ID (if not already populated from env) and click `Load globals`.
   - Expected (UI): `Globals: E: ... · m: ... · UNIT: ... · phase: ...`.
   - See: console `[SubjectActions] /api/pair 200 {...}`.

## Confirm App Account and Funding

4) In the `App account` box, click `Open in LoRA (TestNet)` to view the app account. Use `Check funds`/funds status.
   - Expected (UI): balance line; optional underfunded warning for Return if balance < `t`.
   - See: LoRA account page renders with the derived app address.

## Subject Opt-In

5) In `Subject - Return`, click `Opt-In`.
   - Expected: wallet prompt, then toast `submitted`; pending is polled.
   - See: console `optIn submit ...`, `/api/submit 200 { txId }`, `/api/pending ...` after confirmation; LoRA shows the tx under your account.

## Read Pair States

6) Click `Read pair states` (or `Load globals`).
   - Expected (UI): `Local (subject): s = <value>, done = <0/1>` and `Available for Subject 2: <t> microAlgos (3 x s)`.
   - See: console `[pair/local] <address> { s, done }`.

## Invest (Subject)

7) In `Invest s (microAlgos)`, enter a multiple of `UNIT` (e.g., `40000`) and click `Invest`.
   - Expected: wallet signs a 2‑txn group (payment + app call); toasts `Invest submitted` then `confirmed`.
   - See (UI): Activity shows invest confirmation; `Local (subject): s = 40000, done = 1`; Pair panel `Available ... 120000 microAlgos (3 x s)`; `S1 (investor)` displays a valid address.
   - See (console): `invest submit ...`, `/api/submit 200`, `/api/pending 200 { confirmed-round }`.
   - See (LoRA): the group appears; payment + app call.

## Enable Return

8) Click `Load globals` and `Read pair states` again.
   - Expected: Return button enabled when all hold:
     - `t > 0` and `ret == 0`
     - Subject opted-in (`done == 1`)
     - App balance >= `t`
     - `r` in `0..t` and multiple of `UNIT`
   - See (UI): if blocked, yellow helper text shows exact blocker; otherwise the button is enabled.

## Return (Subject)

9) Enter `r` (e.g., `60000` if `t=120000`) and click `Return`.
   - Expected: wallet signs app call; toasts `Return submitted` then `Return confirmed`.
   - See (UI): status under the form shows submitted → confirmed; Activity shows Return with round and amounts; globals set `ret = 1`.
   - See (console): `Return submit`, `/api/submit 200 { txId }`, `/api/pending 200 { confirmed-round }`.
   - See (LoRA): outer app call with 2 inner payments: `r` to S1 and `t - r` to S2.

## Underfunded Path (Optional)

10) If Return is blocked by underfunding:
    - Fund the App Address with at least `t` microAlgos from any account (QR is shown).
    - Click `Check funds` or `Load globals` to refresh.
    - Expected: underfunded warning clears; Return button enables.
    - See: LoRA shows your funding tx to the app account.

## Admin Phase Changes (Optional)

11) In Admin panel, change phase as needed (1→2 or 2→3).
    - Expected: a phase‑change app call confirms; globals reflect the new `phase`.
    - See: UI globals line; LoRA shows the tx.

## Success Criteria Summary

- After Invest: `s=your amount`, `done=1`; `t=3*s`; S1 is a valid address in Pair panel; Activity shows Invest confirmed with a LoRA link.
- Return button enables when S1 present, app funded >= `t`, and `r` valid.
- After Return: toast and activity confirm; globals `ret=1`; LoRA shows 1 app call + 2 inner payments (r and t−r).

If behavior differs, capture the yellow blocker text and the last few console lines; this pinpoints the next fix.

## Quick Demo (single account)

Run Phase 2 end‑to‑end with one wallet (fast path):

1) Connect Wallet (TestNet).
2) Deploy contract (or use an existing App ID).
3) Fund contract (App Address): for a one‑pass demo, ensure the app will have at least `t = 3 × s` microAlgos after Invest (UI shows low‑balance hints; baseline ~0.20 ALGO).
4) Set App ID in the Subject panel and click “Load globals”.
5) Opt‑In in the Subject panel (ignore “already opted in” if it appears).
6) In “Quick Demo (single account)”, enter:
   - `s` (microAlgos): multiple of UNIT and `<= E` (e.g., 40000 if UNIT=1000)
   - `r` (microAlgos): `0..t` and multiple of UNIT (t becomes `3 × s` after Invest)
7) Click “Run Demo”: [set phase=2 if creator] → Opt‑In → Invest → Read Pair States → check funding → Return.
   - If underfunded for Return, fund the App Address and use “Run Return only”.
8) View results: “Invest” and “Return” show “View on LoRA” links (lora.algokit.io/testnet/tx/<txid>), with outer app call and inner payments.
