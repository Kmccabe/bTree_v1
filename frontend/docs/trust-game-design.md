# Trust Game — Design Spec (MVP, per-pair app)

**Status:** v1 (Sept 9 target)  
**Roles:** E (experimenter/admin), S1 (investor), S2 (trustee)  
**Architecture:** One Algorand smart contract **per pair**, real payouts, wallets for subjects, serverless `/api/*` proxies. Optional Sponsor LogicSig to keep subjects net-zero on fees.

---

## 1) Accounts & App Topology

- **E (admin):** deploys the app, funds the app, sets phase(s).
- **S1 (investor)** and **S2 (trustee):** connect wallet, opt-in, make decisions.
- **Design choice:** **One app per pair** (+ optional one sponsor LogicSig per app).
  - Safer sweeps, simpler funding math, isolation of risk/errors.

---

## 2) Parameters & Notation

- **Globals (set on create):**
  - `E` — endowment (µAlgos; **must be a multiple of `UNIT`**)
  - `m` — integer multiplier (e.g., 3)
  - `UNIT` — µAlgo step size (e.g., 1,000)
  - `phase` — {1: Registration, 2: Investor Decide, 3: Trustee Decide, 4: Finished}
  - `admin` — creator address (implicit)
- **Local (per account):** `reg`, `id`, `s`, `r`, `done`
- **Decision rules (all multiples of `UNIT`):**
  - S1 chooses `s` with `0 ≤ s ≤ E` and `s % UNIT == 0`
  - S2 chooses `y` with `0 ≤ y ≤ m·s` and `y % UNIT == 0`
  - S2 keeps `z = m·s − y`
- **Payouts (MVP flow):**
  - On invest: **`E − s` → S1** (inner payment)
  - On return: **`y → S1`**, **`(m·s − y) → S2`**, then **sweep remainder → E**

---

## 3) Phases

1. **Registration (phase = 1)**  
   Wallet opt-in + on-chain `register(id)` (UI includes a fake uniqueness check).
2. **Investor Decide (phase = 2)**  
   S1 submits `s` via a **2-txn group**:
   - `txn[0]`: Payment `s` S1 → App
   - `txn[1]`: AppCall `"invest"(s)` by S1  
   Contract validates group, records `s`, inner-pays **`E − s`** to S1.
3. **Trustee Decide (phase = 3)**  
   S2 submits `y` (with `accounts[1] = S1`).  
   Contract validates `y ≤ m·s`, inner-pays **`y → S1`** and **`(m·s − y) → S2`**, then **close-remainder → E** and sets `phase = 4`, `done = 1`.
4. **Finished (phase = 4)**  
   Read-only; export data.

---

## 4) Funding

- **App funding** (by E), per pair:  
  **`≈ (m − 1) · E + buffer`** (covering inner-txn fees / rent if any)
- **Subjects must not lose money (fees included):**
  - **Recommended:** Sponsor LogicSig (tiny atomic stipend + payback), plus contract reimburses outer fee inside app calls.
  - **Fallback:** pre-stipend to subjects + fee reimbursement.

---

## 5) Fees & Groups

- **Outer fees** are paid by the outer tx senders (S1 for invest group; S2 for return; E for admin). The app never pays outer fees directly.
- **Set flat fees** using `/api/params.minFee`:
  - **Invest (2 outer txns):** each `≥ minFee`.
  - **Return (1 outer app call):** `fee ≥ minFee × (1 + #inner)` → with 3 inner, use **4–5× minFee**.
- **All decisions** (`E`, `s`, `y`) are multiples of `UNIT`.

---

## 6) Transaction Shapes

### 6.1 Invest (S1, Phase 2)
```
txn[0]: Payment S1 → App amount = s
txn[1]: Application S1 → App appArgs = ["invest", s]
-- inner Payment: App → S1 amount = (E - s)
```

### 6.2 Return + Sweep (S2, Phase 3)
```
txn[0]: Application S2 → App appArgs = ["return", y], accounts[1] = S1
├─ inner Payment: App → S1 amount = y
├─ inner Payment: App → S2 amount = (m*s - y)
└─ inner Payment: App → E close_remainder_to = E // sweep remainder
```


*(If Sponsor LogicSig is enabled, a small stipend/payback pair wraps subject calls; see variants doc.)*

---

## 7) UI & API

- **Admin Setup panel**
  - Inputs: `E (µAlgos)`, `m`, `UNIT`
  - Actions: **Deploy** (compile via `/api/compile`, create via client helper), **Check Funding** (`/api/account?addr=`), **Set Phase**
  - Show **App ID**, **App Address** (copy buttons)
- **PhaseControl**
  - **Registration:** Connect → Join (Opt-In) → Register ID
  - **Investor:** input **Invest Amount** (`step=UNIT`, bounds `0..E`) → **Submit Investment**
  - **Trustee:** input **Return Amount** (`step=UNIT`, bounds `0..m·s`) → **Submit Return**
  - **Results:** show `s`, `y`, payouts; export CSV
- **Serverless APIs:** `/api/compile`, `/api/params`, `/api/submit`, `/api/pending`, `/api/account`, `/api/export` (extended)

---

## 8) Client Helpers

- `deployTrustGame({ sender, E, m, UNIT, sign }) → { appId, appAddress, txId, confirmedRound }`
- `setPhase({ sender, appId, phase, sign })`
- `investFlow({ sender: S1, appId, s, sign })` → 2-txn group
- `returnFlow({ sender: S2, appId, investorAddr, y, sign })` → fee bump + accounts
- *(Optional)* `setParticipants({ sender: E, appId, s1, s2, sign })`

---

## 9) Data Access

- **CSV Export** (artifact of record):  
  `app_id, s1_addr, s2_addr, id_s1, id_s2, E, m, UNIT, s, y, payout_s1, payout_s2, tx_invest, round_invest, tx_return, round_return, ended_at`
- **On-screen results:** subset with explorer links.

---

## 10) Guardrails

- No secrets in client; Algod tokens server-side only.
- Network sanity check (backend genesis vs `VITE_NETWORK`).
- All decisions are multiples of `UNIT` (UI + TEAL enforce).
- Per-pair app to simplify sweep & isolate risk.
- Runtime is TEAL; dev-time PyTeal generator is optional later.

---

## 11) Test Checklist (per pair)

1. **Deploy:** set `E, m, UNIT` → Deploy → get **App ID/Address** → fund app to `(m − 1)·E + buffer` → **Check Funding** OK.
2. **Phase 1:** S1 & S2 connect, opt-in, register (fake uniqueness passes).
3. **Phase 2:** S1 invests valid `s` → S1 receives **`E − s`**; app retains enough for returns.
4. **Phase 3:** S2 returns `y` → S1 gets **`y`**, S2 gets **`m·s − y`**; **app sweeps remainder → E**, `phase = 4`.
5. **Export:** CSV includes `s`, `y`, payouts, txids, rounds.
6. **(If Sponsor enabled):** subjects can act from 0 ALGO; net fee = 0.

*(If Sponsor LogicSig is enabled, a small stipend/payback pair wraps subject calls; see variants doc.)*

---

## 7) UI & API

- **Admin Setup panel**
  - Inputs: `E (µAlgos)`, `m`, `UNIT`
  - Actions: **Deploy** (compile via `/api/compile`, create via client helper), **Check Funding** (`/api/account?addr=`), **Set Phase**
  - Show **App ID**, **App Address** (copy buttons)
- **PhaseControl**
  - **Registration:** Connect → Join (Opt-In) → Register ID
  - **Investor:** input **Invest Amount** (`step=UNIT`, bounds `0..E`) → **Submit Investment**
  - **Trustee:** input **Return Amount** (`step=UNIT`, bounds `0..m·s`) → **Submit Return**
  - **Results:** show `s`, `y`, payouts; export CSV
- **Serverless APIs:** `/api/compile`, `/api/params`, `/api/submit`, `/api/pending`, `/api/account`, `/api/export` (extended)

---

## 8) Client Helpers

- `deployTrustGame({ sender, E, m, UNIT, sign }) → { appId, appAddress, txId, confirmedRound }`
- `setPhase({ sender, appId, phase, sign })`
- `investFlow({ sender: S1, appId, s, sign })` → 2-txn group
- `returnFlow({ sender: S2, appId, investorAddr, y, sign })` → fee bump + accounts
- *(Optional)* `setParticipants({ sender: E, appId, s1, s2, sign })`

---

## 9) Data Access

- **CSV Export** (artifact of record):  
  `app_id, s1_addr, s2_addr, id_s1, id_s2, E, m, UNIT, s, y, payout_s1, payout_s2, tx_invest, round_invest, tx_return, round_return, ended_at`
- **On-screen results:** subset with explorer links.

---

## 10) Guardrails

- No secrets in client; Algod tokens server-side only.
- Network sanity check (backend genesis vs `VITE_NETWORK`).
- All decisions are multiples of `UNIT` (UI + TEAL enforce).
- Per-pair app to simplify sweep & isolate risk.
- Runtime is TEAL; dev-time PyTeal generator is optional later.

---

## 11) Test Checklist (per pair)

1. **Deploy:** set `E, m, UNIT` → Deploy → get **App ID/Address** → fund app to `(m − 1)·E + buffer` → **Check Funding** OK.
2. **Phase 1:** S1 & S2 connect, opt-in, register (fake uniqueness passes).
3. **Phase 2:** S1 invests valid `s` → S1 receives **`E − s`**; app retains enough for returns.
4. **Phase 3:** S2 returns `y` → S1 gets **`y`**, S2 gets **`m·s − y`**; **app sweeps remainder → E**, `phase = 4`.
5. **Export:** CSV includes `s`, `y`, payouts, txids, rounds.
6. **(If Sponsor enabled):** subjects can act from 0 ALGO; net fee = 0.
