# INTEGRITY

This doc explains how to verify that exported data corresponds to on-chain facts.

## LoRA Links: Build and Navigate

LoRA TestNet base: `https://lora.algokit.io/testnet`

- Application by `appId`:
```text
https://lora.algokit.io/testnet/application/<APP_ID>
```
- App-call transaction by `txId` (outer app call):
```text
https://lora.algokit.io/testnet/tx/<TXID>
```
- Inner payments: open the outer app-call tx page; LoRA renders an “Inner transactions” section listing payment receivers and amounts.
- Grouping by appId/session: use the Application page for `<APP_ID>` to browse chronological app-call transactions for a session (one appId == one game instance). Use timestamps to align with your CSV `session_id`.

## Verify via Explorer (LoRA)

Use LoRA TestNet to review key transactions and inner payments:

- App link: `https://lora.algokit.io/testnet/application/<APP_ID>`
- Tx link: `https://lora.algokit.io/testnet/tx/<TXID>`
- Account link: `https://lora.algokit.io/testnet/account/<ADDRESS>`

Procedure (per session/app):
1. Identify `tx_invest` and `tx_return` from `/api/history` or UI.
2. Open each in LoRA and confirm:
   - Invest: outer group (if used) and inner payment refund `E1 − s` → S1.
   - Return: inner payments `r` → S1 and `(t − r + E2)` → S2.
3. Cross-check addresses and amounts match your CSV.

Tip: `/api/history` provides decoded `event` and minimal `details` (`s`, `r`, `new_phase`), plus `innerPayments` with `{ to, amount }`.

## Session Verification Checklist (LoRA)

1) Locate Invest transaction (event = `invest`)
- On the Application page for `<APP_ID>`, find the tx with event `invest`.
- Note `s` from args/details; fetch `m` from globals and compute `t = m × s`.

2) Confirm multiplier application
- Compare your computed `t` with UI/CSV `t`.
- If mismatch, re-check `m` and `s` units (µAlgos) and ensure `s % UNIT == 0`.

3) Locate Return transaction (event = `return`)
- Open the tx page; in “Inner transactions” verify two payments exist.
- Validate amounts:
  - One payment equals `r` (to S1)
  - One payment equals `t − r` (to S2)
  - Amounts sum to `t`
  - Note: In variants with trustee endowment `E2`, the second payment may be `t − r + E2`.

4) Confirm Sweep (if applicable)
- After Phase 3, optional admin “sweep” payment may appear as an app call with an inner pay to the creator/admin.
- Verify the swept amount matches expected remaining funds.

5) Cross-check phases
- Use `/api/history` “set_phase” events or LoRA logs to confirm the sequence 0 → 1 → 2 → 3.

## Verify via On-Chain Digest (optional pattern)

If the app records a finalize digest:
1. During `finalize()`, submit SHA‑256 over canonical JSON lines of events in order; store under a global key (e.g., `fd`).
2. Recreate export deterministically from Indexer:
   - Fetch app-call txns by `appId`.
   - Canonicalize event JSON lines.
   - Compute SHA‑256 and compare to on-chain digest `fd`.

This allows reviewers to independently reconstruct and verify your dataset using only:
- Network (TestNet)
- App ID

## Common Mismatches & Fixes

- Wrong network: ensure LoRA TestNet, not MainNet; confirm appId exists on TestNet.
- Stale indexer: LoRA/Indexer may lag 1–2 minutes; wait and refresh or query node directly.
- Units mismatch: values are µAlgos; verify multiples of `UNIT` and integer math for `t = m × s`.
- AppId confusion: each game instance has a distinct `appId`; verify you’re checking the correct one.
- Inner payments hidden: open the specific app-call tx page; inner transactions are nested on that page.
