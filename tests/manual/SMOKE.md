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
- Admin → Deploy & Manage Pair: click "Deploy"; note App ID (phase = 0).
- Admin: click "Check funding" (optional).
- Before Invest, fund app so liquid ≥ E1 − s (worst-case, fund E1 up-front).
- Subject - Invest: click "Opt-In" as S1 (latches s1).
- Subject - Return: click "Opt-In" as S2 (latches s2).
- Admin: set phase with buttons (e.g., "Phase: Invest(1)") if needed.
- Subject - Invest: enter s, click "Invest" (must be multiple of UNIT and ≤ E1).
- Subject - Return: click "Load globals" then "Read pair states"; ensure S1 shows.
- After Invest, fund app so liquid ≥ t + E2, where t = m × s.
- Subject - Return: enter r and click "Return" (0 ≤ r ≤ t, multiple of UNIT).
- Verify: phase → 3 (Done), ret = 1; payouts r → S1 and (t − r + E2) → S2.
- Optional: Admin: click "Sweep" (phase 3) to send leftover to creator.

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

### 0. Compile & Deploy
- [ ] Admin → Deploy & Manage Pair → click "Deploy".
  - Inputs: `E1=2.0`, `E2=0.5`, `m=3`, `UNIT=0.1`.
  - The UI compiles TEAL via `/api/compile` and submits the app-create.
- [ ] Copy the displayed "App ID" and "App Address".
- [ ] Confirm globals via Admin or Subject panels using "Load globals" or "Read pair state(s)".
  - Expected: `UNIT=0.1`, `m=3`, `E1=2.0`, `E2=0.5`.
- [ ] Phase = **0 (Registration)** (Admin shows current phase; phase buttons available).

### 1. Registration
- [ ] Subject - Invest panel: enter App ID if needed, click "Opt-In" as S1 → `s1` latched.
- [ ] Subject - Return panel: enter App ID if needed, click "Opt-In" as S2 → `s2` latched.
- [ ] Admin: if still phase 0, click "Phase: Invest(1)" (or select phase 1 and "Apply").

### 2. Seed Funding (Pre-Invest)
- [ ] Admin: click "Check funding" (optional) to see current balance.
- [ ] Pre-fund app so liquid ≥ E1 − s (worst-case, fund E1 if s not known yet).
  - Example here: E1 − s = 0.8 ALGO → fund at least 0.8 ALGO before Invest.
  - Note: Group payment of s goes to app, but solvency checks for refund use current liquid balance; don’t rely on the incoming s.
  - Keep ≥ 0.1 ALGO minimum in account at all times.

### 3. Invest
- [ ] Subject - Invest: set `s = 1.2 ALGO` (enter microAlgos) and click "Invest".
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
- [ ] Post-state (click "Read pair states"):
  - `s=1.2`, `t=3.6`, `invested=1`
  - Phase = **2 (Return)**
- [ ] App balance now reflects: +s (payment) − (E1 − s) (refund) + prior seed − fees.

### 4. Top-Up (Pre-Return)
- [ ] Admin tops up so liquid ≥ t + E2 (example: 3.6 + 0.5 = 4.1 ALGO).
- [ ] Click "Check funding" to verify.
- [ ] (Optional buffer for fees; Sweep later will transfer leftover liquid except 0.1 ALGO min.)

### 5. Return
- [ ] Subject - Return: click "Load globals" then "Read pair states" to surface S1.
- [ ] Enter `r = 1.0 ALGO` (microAlgos) and click "Return".
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
