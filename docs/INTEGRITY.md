# INTEGRITY

This doc explains how to verify that exported data corresponds to on-chain facts.

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
