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

### Compile via AlgoKit (recommended)

Requires AlgoKit 2.2.x and an active profile (localnet recommended).

1. Install AlgoKit:
   ```bash
   pipx install "algokit==2.2.*"
   ```
2. Start localnet & select profile:
   ```bash
   algokit localnet start
   algokit config set profile=localnet
   ```
3. Run the compile task:
   ```bash
   algokit task compile-escrow
   ```
4. Artifacts (same as legacy path):
   - `contracts/artifacts/bank_account_escrow.teal`
   - `contracts/artifacts/bank_account_escrow.address.txt`

### Legacy compile path

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

## Compile Log Streaming (Admin UI)

The Admin dashboard can stream compile logs in two modes:

- **Chunked (default)** — server returns newline-delimited text where the final line is JSON status, e.g.:
  ```
  starting algokit compile
  step 1/3: building...
  step 2/3: linking...
  step 3/3: artifact ready
  {"ok":true,"escrow_addr":"XPLQ...7S3"}
  ```
- **SSE (`?watch=1`)** — `text/event-stream` with progress blocks followed by a `event: done` payload:
  ```
  data: starting algokit compile

  data: step 1/3: building...

  data: step 2/3: linking...

  data: step 3/3: artifact ready

  event: done
  data: {"ok":true,"escrow_addr":"XPLQ...7S3"}
  ```

Configure the frontend via `VITE_COMPILE_STREAM_MODE=chunk` (or `sse`). If malformed JSON or network errors occur, the UI marks the compile as failed. Clipboard buttons show toasts (“Copied log (N lines)” / “Copy failed — try again or select text manually”).
