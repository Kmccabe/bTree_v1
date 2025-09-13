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
   - Expected (UI): shows `Connected: <your-address>` and account info.
   - See: also browser console logs tagged `[appId]` and `[SubjectActions]` when you take actions.

## Set App ID and Load Globals

3) Enter your App ID (if not already populated from env) and click `Load globals` (button label: exactly "Load globals").
   - Expected (UI): globals available to the Subject panel; phase visible in Admin panel.
   - See: console `[SubjectActions] /api/pair 200 {...}`.

## Confirm App Account and Funding

4) Confirm app funding as Subject (or via Admin panel).
   - Subject: use the inline balance/funding hints when present; otherwise proceed and observe underfunding warnings.
   - Admin: "Fund Experiment" section shows Required pool and "Check Funding to Start".
   - Expected (UI): underfunded warnings if balance < required; hints clear once funded.

## UI controls (current build)

- Subject 1 (Invest): label "Invest s (microAlgos):" with input and button "Invest"; after confirmation, an "Invest Done" button appears (creator only) to advance the phase.
- Subject 2 (Return): label "r (microAlgos):" with input and button "Return"; also a "Load globals" button.
- Wallet connect: Subject panels show a "Connect wallet" link button when not connected; "Disconnect" when connected.
- Admin: phase buttons labeled "Phase: 0 (Registration)", "Phase: 1 (Setup)", "Phase: 2 (Invest)", "Phase: 3 (Return/Done)", and a "Sweep" button in Done.

## Preconditions for Return

6) Ensure the following before testing Return:
   - S1 Invest confirmed (inline status shows "Invest confirmed…" and Activity lists the invest).
   - App funded ≥ `t + E2` (Subject panel may show "Underfunded"; Admin shows Required pool).
   - S1 detected in globals (if missing, click "Load globals").
   - Phase label in Admin is "Phase: 3 (Return/Done)" after Invest (creator can click "Invest Done").

## Invest (Subject)

7) In `Invest s (microAlgos)`, enter a multiple of `UNIT` (e.g., `40000`) and click `Invest`.
   - Expected: wallet signs a 2‑txn group (payment + app call); toasts `Invest submitted` then `confirmed`.
   - See (UI): Activity shows invest confirmation; `Local (subject): s = 40000, done = 1`; Pair panel `Available ... 120000 microAlgos (3 x s)`; `S1 (investor)` displays a valid address.
   - See (console): `invest submit ...`, `/api/submit 200`, `/api/pending 200 { confirmed-round }`.
   - See (LoRA): the group appears; payment + app call.

## Return input validation

8) In the Subject 2 panel, enter `r` in the "r (microAlgos):" input.
   - Validation: integer; `0 ≤ r ≤ t`; multiples of `UNIT`.
   - Expected (UI): if invalid, inline yellow helper: "Enter r between 0 and <t>" or "Underfunded..."; Return button disabled until valid.

## Return (Subject)

9) Enter `r` (e.g., `60000` if `t=120000`) and click "Return".
   - Expected (UI receipts): inline status shows "Return submitted… (waiting for confirmation)" then "Return confirmed…"; ret=1 reflected in globals after refresh.
   - See (console): Return submit → `/api/submit 200` → `/api/pending 200 { confirmed-round }`.
   - See (LoRA): outer app call with 2 inner payments: `r` → S1 and `t - r` → S2.

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
