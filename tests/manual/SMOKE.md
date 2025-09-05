# 🔥 Smoke Test: Single-Pair Trust App (Dual Endowments)

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
- t = m × s = 3 × 1.2 = **3.6 ALGO**
- Funding bound: F ≥ (m−1)·s + E2 = 2·1.2 + 0.5 = **2.9 ALGO**
- Required balance at Return: B ≥ t + E2 = **4.1 ALGO**
- Payouts on Return:
  - To S1: **1.0 ALGO**
  - To S2: **3.1 ALGO**
  - Total = **4.1 ALGO**

---

## ✅ Test Steps

### 0. Compile & Deploy
- [ ] Compile `approval.teal` and `clear.teal` via `/api/compile`.
- [ ] Deploy with args `[E1=2.0, E2=0.5, m=3, UNIT=0.1]`.
- [ ] Confirm globals in UI: UNIT=0.1, m=3, E1=2.0, E2=0.5.
- [ ] Phase = **0 (Registration)**.

### 1. Registration
- [ ] S1 Opt-In → `s1` latched.
- [ ] S2 Opt-In → `s2` latched.
- [ ] Phase advances to **1 (Invest)**.

### 2. Seed Funding
- [ ] Admin sends **0.5 ALGO** to app (≥ E2).
- [ ] Confirm app balance increases accordingly.

### 3. Invest
- [ ] S1 submits grouped tx:
  - Tx0: Payment **1.2 ALGO** → app.
  - Tx1: AppCall `"invest"` with arg `s=1.2`.
- [ ] Contract checks:
  - Sender = S1
  - Phase = 1
  - `s % UNIT == 0`, `0 ≤ s ≤ E1`
  - Payment matches amount/receiver
- [ ] Post-state:
  - `s=1.2`, `t=3.6`, `invested=1`
  - Phase = **2 (Return)**
- [ ] App balance now = 0.5 (seed) + 1.2 (s) = **1.7 ALGO**.

### 4. Top-Up
- [ ] Admin tops up **2.4 ALGO** so total pre-fund = 2.9 ALGO.
- [ ] Now app balance = s + F = 1.2 + 2.9 = **4.1 ALGO**.
- [ ] (Optional buffer: send 2.45 for balance 4.15 ALGO to test Sweep later.)

### 5. Return
- [ ] S2 submits AppCall `"return"` with arg `r=1.0`.
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
- [ ] Admin calls Sweep at phase=3.
- [ ] If exact funding, leftover ≈ 0.
- [ ] If buffered funding, leftover ≈ 0.05 ALGO swept to admin.

---

## 🔎 Verification Checklist
- [ ] Return fails if attempted **before** top-up (balance too low).
- [ ] `s` or `r` not multiples of UNIT are rejected.
- [ ] Third opt-in rejected.
- [ ] Fees:
  - S1 ~0.003 ALGO (Opt-In + Invest)
  - S2 ~0.002 ALGO (Opt-In + Return)
  - Admin ~0.001 ALGO per deploy/funding/sweep
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
