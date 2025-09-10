# 🔥 Smoke Test: Single-Pair Trust App (Dual Endowments)

## UI Legend
- Admin panel: “Deploy & Manage Pair”
  - Buttons: “Deploy”, “Check funding”, phase controls (e.g., “Phase: Invest(1)” or select + “Apply”), “Sweep”.
  - Shows: App ID, App Address, funding requirements.
- Subject - Invest panel: main “Subject - Invest” card
  - Buttons: “Load globals”, “Opt-In”, “Check funds”, “Read pair states”, “Invest”.
  - Shows: UNIT/E1, input for s (microAlgos), inline status and activity.
- Subject - Return panel: “Subject - Return” card
  - Buttons: “Load globals”, “Opt-In”, “Read pair states”, “Return”.
  - Shows: t (available), constants, r input (microAlgos), S1 after reading pair states.

## Quick Checklist (TL;DR)
1) Deploy → note App ID (phase 0)
2) Seed funds (optional) → ensure pre‑invest refund solvency (≥ E1 − s)
3) Phase 1 (Admin) → enable Invest
4) S1: "Invest s (microAlgos)" → Invest (s % UNIT == 0; s ≤ E1)
5) Fund app ≥ t + E2 (t = m × s)
6) Phase 3 (Return/Done) → after Invest, creator clicks "Invest Done" or Admin sets phase
7) S2: "r (microAlgos)" → Return (0 ≤ r ≤ t; r % UNIT == 0)
8) Phase 3 → Sweep (optional)
9) Export CSV (optional)

**Network:** Algorand TestNet  
**Wallets:** S1 = Investor, S2 = Trustee, Exp = Admin  
**Params (example run):**
- UNIT = 0.1 ALGO (100,000 µALGO)
- m = 3
- E1 = 2.0 ALGO (S1 endowment, off-chain)
- E2 = 0.5 ALGO (S2 endowment, on-chain)
- s = 1.2 ALGO (S1 invests; multiple of UNIT)
- r = 1.0 ALGO (S2 returns; multiple of UNIT)

**Math expectations:**
- Invest stage refund: E1 − s = 2.0 − 1.2 = **0.8 ALGO** (paid to S1 at Invest)
- t = m × s = 3 × 1.2 = **3.6 ALGO**
- Return requirement: liquid ≥ t + E2 = **4.1 ALGO**
- Return payouts:
  - To S1: **r = 1.0 ALGO**
  - To S2: **t − r + E2 = 3.1 ALGO**
  - Total = **4.1 ALGO**

---

## ✅ Test Steps

### Tx IDs to record (fill during run)

```csv
app_id,deploy_txid,invest_appcall_txid,invest_payment_txid,return_txid,sweep_txid
,,,
```

### 0. Compile & Deploy
- [ ] Admin → Deploy & Manage Pair → click "Deploy".
  - Inputs: `E1=2.0`, `E2=0.5`, `m=3`, `UNIT=0.1`.
  - The UI compiles TEAL via `/api/compile` and submits the app-create.
- [ ] Copy the displayed "App ID" and "App Address".
- [ ] Confirm globals via Admin or Subject panels using "Load globals" or "Read pair state(s)".
  - Expected: `UNIT=0.1`, `m=3`, `E1=2.0`, `E2=0.5`.
- [ ] Phase = **0 (Registration)** (Admin shows current phase; phase buttons available).

### 1. Registration / Setup
- [ ] Admin: if phase 0, click "Phase: 1 (Setup)" (or your build’s Invest‑enabling control).

### 2. Seed Funding (Pre-Invest)
- [ ] Admin: click "Check funding" (optional) to see current balance.
- [ ] Pre-fund app so liquid ≥ E1 − s (worst-case, fund E1 if s not known yet).
  - Example here: E1 − s = 0.8 ALGO → fund at least 0.8 ALGO before Invest.
  - Note: Group payment of s goes to app, but solvency checks for refund use current liquid balance; don’t rely on the incoming s.
  - Keep ≥ 0.1 ALGO minimum in account at all times.

### 3. Invest
- [ ] Subject - Invest: set `s = 1.2 ALGO` in "Invest s (microAlgos):" and click "Invest".
  - Grouped tx auto-built:
    - Tx0: Payment **1.2 ALGO** → app.
    - Tx1: AppCall `"invest"` with arg `s=1.2`.
- [ ] Contract checks:
  - Sender = S1
  - Phase = 1
  - `s % UNIT == 0`, `0 ≤ s ≤ E1`
  - Payment matches amount/receiver
- [ ] Inner payment at Invest:
  - **E1 − s = 0.8 ALGO → S1** (refund of S1’s endowment)
- [ ] Post-state:
  - `s=1.2`, `t=3.6` (UI shows availability for S2)
  - Phase advances to Return (label may be "Phase: 3 (Return/Done)" in current build)
- [ ] App balance now reflects: +s (payment) − (E1 − s) (refund) + prior seed − fees.

### 4. Top-Up (Pre-Return)
- [ ] Admin tops up so liquid ≥ t + E2 (example: 3.6 + 0.5 = 4.1 ALGO).
- [ ] Click "Check funding" to verify.
- [ ] (Optional buffer for fees; Sweep later will transfer leftover liquid except 0.1 ALGO min.)

### 5. Return
- [ ] Subject - Return: click "Load globals" to surface S1.
- [ ] Enter `r = 1.0 ALGO` (microAlgos) in "r (microAlgos):" and click "Return".
- [ ] Contract checks:
  - Sender = S2
  - Phase = 2
  - `r % UNIT == 0`, `0 ≤ r ≤ t`
  - Balance ≥ t + E2 = 4.1 ALGO
- [ ] Inner payments executed:
  - **1.0 ALGO → S1**
  - **3.1 ALGO → S2**
- [ ] Post-state: `ret=1`, Phase = **3 (Done)**.

### 6. Sweep (Optional)
- [ ] Admin: at phase 3 (Done), click "Sweep".
- [ ] If exact funding, leftover ≈ 0.
- [ ] If buffered funding, leftover ≈ 0.05 ALGO swept to admin.

---

## 🔎 Verification Checklist
- [ ] Return fails if attempted **before** top-up (balance too low).
- [ ] `s` or `r` not multiples of UNIT are rejected.
- [ ] Fees: expect small network fees on each operation (deploy/funding/invest/return/sweep)
- [ ] LoRA explorer shows inner txns:
  - 1.0 ALGO → S1
  - 3.1 ALGO → S2
  - Total outflow = 4.1 ALGO

---

## 🚨 Common Failure Modes
- Underfunded Return → error: “Balance < t + E2.”
- Invest rejected if group invalid or sender ≠ S1.
- Return rejected if sender ≠ S2 or phase mismatch.
- Non-UNIT multiples rejected.
