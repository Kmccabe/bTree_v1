# Trust Game — Variants & Treatments (Future Options)

This document captures optional flows we **may** implement later. The core MVP spec lives in `trust-game-design.md`.

---

## A) Upfront Endowment at Opt-In (S1)

**Idea:** Pay S1 the full endowment **E** immediately during registration/opt-in; S1 later “invests” by returning `s` in Phase 2.

### Flow differences
- **Registration (phase = 1) — S1 only**
  - AppCall `"register"(id)` (or opt-in handler) triggers **inner payment `E → S1`**.
  - Contract marks `reg=1`, stores `id`, guards against double payout.
- **Investor Decide (phase = 2)**
  - S1 pays `s` back to the app (`0..E`, `% UNIT == 0`), optionally accompanied by an app call to attest `s`.
- **Trustee Decide (phase = 3)**
  - Same as MVP: S2 returns `y`; contract pays `y → S1`, `(m·s − y) → S2`; then **sweep remainder → E**; `phase = 4`.

### Funding & risk
- App still needs ~`m·E` to guarantee trustee payouts.
- **Risk:** S1 could take E and never invest. This is an intentional treatment; UI/consent must reflect it.

### Enablement plan
- Config flag: `UPFRONT_ENDOWMENT=true` (client + TEAL branches).
- TEAL: add inner pay `E → S1` on S1’s register; store `paid_e=1`; adjust invest path.
- UI: warn S1 about immediate E; investor step still validates `0..E`.

---

## B) Sponsor LogicSig (Atomic Stipend for Fees)

**Goal:** Subjects start at 0 ALGO and still pay **no net fees**.

### Pattern
Make each subject action an **atomic 3-tx group**:
```
[ stipend → subject, subject AppCall(s), subject payback → sponsor/app ]
```
- **LogicSig constraints:**
  - Fixed `App ID`
  - Group size & order exactly as above
  - Stipend ≤ cap (e.g., 0.02 ALGO)
  - Payback equals stipend
  - Receiver of stipend == sender of the next tx

### Where to use
- Opt-in
- Invest
- Return

### Contract side
- In `"invest"`/`"return"`, **reimburse the subject’s outer fee** via inner payment so net fee = 0.

### Operational notes
- E funds the **sponsor account** with a small float for stipends + its own tx fees.
- Each grouped action is auditable: you see stipend→call→payback in one atomic unit.

---

## C) Multi-Pair Single Contract (Not in MVP)

**Idea:** One app for many pairs, sweeping only after **all pairs** finish.

**Pros:** Fewer deployments, shared config.  
**Cons:** Complex bookkeeping (pair state, completion tracking), tricky funding (avoid draining funds early), harder isolation of failures.  
**Status:** Not planned for MVP; stick to **per-pair**.

---

## D) Commit–Reveal (Privacy for Investor Choice)

**Idea:** Hide S1’s `s` until S2 decides.

**Flow:**
- Phase 2a: S1 submits `commit = hash(s || salt)`
- Phase 3: S2 decides `y` without seeing `s`
- Phase 2b (reveal window): S1 reveals `(s, salt)`; contract verifies `hash == commit`, then pays `E − s`, etc.

**Trade-offs:** More UX + error cases (missed reveals). Useful only if privacy is crucial.  
**Status:** Deferred.

---

## E) Alternative Payoff Schedules

You can parameterize payout formulas:
- Nonlinear multiplier `m(s)`, caps, or floors
- Trustee bonus/penalty bands
- Constraint presets (e.g., “no-rebid”)

**Status:** Possible via TEAL parameterization or dev-time PyTeal → TEAL generator.

---

