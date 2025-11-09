# Bank Account Escrow LogicSig (Design & Ops)

Stateless LogicSig escrow that funds subject registrations with capped payments.
This document summarizes where the source lives, how to compile it, and how to
propagate the resulting address into the frontend environment.

## Source Files

| Path | Purpose |
| ---- | ------- |
| `contracts/bank_account_escrow.py` | PyTeal source defining `bank_account_escrow()` (TEAL v8, payment-only, capped at 200_000 µAlgos, rekey disabled). |
| `contracts/escrow_compile.py` | Build helper that compiles the LogicSig to `contracts/artifacts/` and derives the escrow address using `goal clerk compile` (with an Algod fallback). |

## Compile Workflow

1. Ensure the Algorand CLI (`goal`) is installed **or** export the following so the script can call an Algod compile endpoint as fallback:
   - `ALGOD_ADDRESS`
   - `ALGOD_TOKEN`
   - `ALGOD_HEADERS` (JSON, optional)
2. From the repo root run:
   ```bash
   python contracts/escrow_compile.py
   ```
3. Artifacts produced under `contracts/artifacts/`:
   - `bank_account_escrow.teal`
   - `bank_account_escrow.address.txt` (contains the LogicSig address derived from `goal`/Algod; value is **environment-specific**)

> **Note:** If both `goal` and Algod settings are missing, the script still writes the TEAL file but warns that the address must be derived manually.

## Dry-Run Checks (after compilation)

Create signed transaction files (`*.stxn`) that exercise each scenario, then run:

```bash
goal clerk dryrun -t payment_pass.stxn    # Payment ≤ 200_000 µAlgos → should PASS
goal clerk dryrun -t nonpayment.stxn      # Non-payment txn          → should FAIL
goal clerk dryrun -t overpay.stxn         # Amount > 200_000 µAlgos  → should FAIL
goal clerk dryrun -t rekey.stxn           # Rekey != zero_address    → should FAIL
tealdbg debug contracts/artifacts/bank_account_escrow.teal  # Optional step-through
```

Logs from these commands depend on the local sandbox/network and are **not** committed.

## Frontend/Env Updates

After a real compile:

1. Open `contracts/artifacts/bank_account_escrow.address.txt` and copy the LogicSig address.
2. Add it to the frontend env file:
   ```
   VITE_BANK_ESCROW_ADDR=<REAL_ESCROW_ADDRESS>
   ```
3. Fund the escrow with ~5 ALGO from the sponsor wallet and verify the TestNet balance before using it in registration flows.
