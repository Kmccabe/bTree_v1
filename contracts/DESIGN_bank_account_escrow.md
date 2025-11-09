# Design Document: Bank-Account Escrow LogicSig (Step 1)
**Branch:** feature/bank-account-contract  
**Status:** Design Approved — No Implementation or Execution

---

## Purpose
Define the design and workflow for a **stateless “bank-account escrow” LogicSig** used to fund subject registrations in bTree.  
This document specifies file placement, build wiring, artifacts, address-derivation, environment requirements, and illustrative testing commands.  
All hashes, addresses, and logs are **PLACEHOLDERS**.

---

## Repository Context
- Manual build scripts (`build.py`, `registry/compile.py`); no auto-discovery  
- Artifact outputs: `contracts/artifacts/`  
- TEAL version 8 used consistently  
- Builds executed via Python (not AlgoKit)

---

## File Placement & Wiring
| Type | Path | Notes |
|------|------|-------|
| Source | `contracts/bank_account_escrow.py` | Stateless LogicSig definition |
| Compiler script | `contracts/escrow_compile.py` | Compiles and derives address |
| Artifacts dir | `contracts/artifacts/` | Output for `.teal` and `.address.txt` |

**Manual build integration**
```python
from contracts import escrow_compile
escrow_compile.main()
```
Insert inside `contracts/build.py` if a unified build is desired.

---

## PyTeal Source (Design-Only)
```python
from pyteal import *

MAX_PAYOUT = 200_000
REGISTRY_APP_ID = 747540520

def bank_account_escrow() -> Expr:
    return And(
        Txn.type_enum() == TxnType.Payment,
        Txn.amount() <= Int(MAX_PAYOUT),
        Txn.rekey_to() == Global.zero_address()
    )

if __name__ == "__main__":
    print(compileTeal(bank_account_escrow(), Mode.Signature, version=8))
```
- Importable by `escrow_compile.py`; `__main__` block for inspection only  
- TEAL target: v8

---

## Compile Script Responsibilities (Design-Only)
`contracts/escrow_compile.py` will:
1. Import `bank_account_escrow()` from `contracts/bank_account_escrow`
2. Compile with `compileTeal(..., Mode.Signature, version = 8)`
3. Write `contracts/artifacts/bank_account_escrow.teal`
4. Derive the LogicSig address  
   - **Primary:** shell out to `goal clerk compile contracts/artifacts/bank_account_escrow.teal`, parse `Address:` line from stdout (Algorand CLI must be on PATH)  
   - **Fallback:** if `goal` is unavailable, use `py-algorand-sdk.LogicSig` to compute the address from compiled bytes
5. Write address to `contracts/artifacts/bank_account_escrow.address.txt`
6. Print confirmation of written artifact paths  
_All addresses and hashes here are PLACEHOLDERS._

---

## Compilation Workflow (Document Only – Not Executed)
```powershell
python contracts/escrow_compile.py
```
Expected outputs (PLACEHOLDER names):  
```
contracts/artifacts/bank_account_escrow.teal
contracts/artifacts/bank_account_escrow.address.txt
```

---

## Dry-Run Verification (Illustrative Only – Not Executed)
Before running, admins must create test signed transactions (`*.stxn`) with  
`goal clerk send` or `goal clerk rawsend`.

Example commands (illustrative only):
```bash
goal clerk dryrun -t payment_pass.stxn   # ≤ MAX_PAYOUT → pass
goal clerk dryrun -t nonpayment.stxn     # non-Payment → fail
goal clerk dryrun -t overpay.stxn        # > MAX_PAYOUT → fail
goal clerk dryrun -t rekey.stxn          # rekey ≠ zero → fail
tealdbg debug contracts/artifacts/bank_account_escrow.teal
```
**PROMINENT NOTE:** Illustrative only — **NOT executed; no logs included**

---

## Artifacts & Naming
- `contracts/artifacts/bank_account_escrow.teal`  
- `contracts/artifacts/bank_account_escrow.address.txt`  
No ABI JSON is generated for LogicSig contracts.

---

## Admin Checklist (Post-Implementation)
1. Run `python contracts/escrow_compile.py`  
2. Open `.address.txt` and copy the **real** address  
3. Add to `.env.local`: `VITE_BANK_ESCROW_ADDR=<REAL address>`  
4. Fund that address with ≈ 5 ALGO from the sponsor wallet  
5. Verify its TestNet balance before use

---

## Documentation Cross-Links
After implementation:
- Create `contracts/README_bank_account_escrow.md` describing purpose, compile command, and funding steps  
- Link this README **under the “Contracts” section** of the main `contracts/README.md`

---

## Acceptance Criteria
- Defines explicit manual build wiring and optional integration hook  
- Confirms artifact paths and filenames (`contracts/artifacts/`)  
- Provides complete PyTeal source with constants and TEAL v8 target  
- Specifies address derivation (`goal clerk compile` with SDK fallback)  
- All outputs clearly labeled PLACEHOLDER / NOT EXECUTED  
- Notes dry-run transaction prerequisites  
- Defines Admin Checklist and documentation cross-links

---
