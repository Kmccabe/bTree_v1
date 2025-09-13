
# Trust Game Experiment App – Daily Checklist (Deadline: Sept 9)

## 📅 Aug 29 (Fri) – Kick-off
- [x] Repo created (`contracts/`, `frontend/`, `scripts/`, `tests/`, `infra/`)
- [x] `.env.local` set with **LocalNet** + **TestNet** endpoints
- [x] `algokit localnet start` runs, algod/indexer reachable (SDK only)
- [x] Pera in **Developer Mode → TestNet**, account funded from dispenser
- [x] Vercel deploy live, “Connect Pera Wallet” works (TestNet)

## 📅 Aug 30 (Sat) – Contract scaffold
- [ ] Algorand Python skeleton contract written (methods stubbed)
- [ ] Deployed on **LocalNet** (SDK) and **TestNet** (Pera-funded)
- [ ] App-ids recorded for both

## 📅 Aug 31 (Sun) – Registration
- [ ] `register_subject` implemented
- [ ] Two Pera wallets register on TestNet
- [ ] Same wallet cannot re-register (error shown)
- [ ] Logs visible in TestNet Indexer

## 📅 Sept 1 (Mon) – Pairing & roles
- [ ] `pair(address_a, address_b)` callable by experimenter only
- [ ] Subjects see assigned role (A or B) in TestNet UI
- [ ] CI test pairing succeeds on LocalNet

## 📅 Sept 2 (Tue) – Commit & reveal
- [ ] `commit_choice` (hash) + `reveal_choice` (value + salt) implemented
- [ ] Pera wallets successfully commit & reveal on TestNet
- [ ] Wrong salt/value rejected
- [ ] Logs retrievable via Indexer

## 📅 Sept 3 (Wed) – Settlement
- [ ] `settle(pair_id)` computes payoffs
- [ ] (Optional) inner payments from app account on TestNet
- [ ] LocalNet test verifies math correctness

## 📅 Sept 4 (Thu) – CSV exporter
- [ ] Vercel serverless `/api/export` returns CSV for given TestNet app-id
- [ ] Export includes register/commit/reveal/settle events
- [ ] (Optional) same exporter running on Railway
- [ ] LocalNet CI exporter works

## 📅 Sept 5 (Fri) – Digest & finalize
- [ ] `finalize()` emits SHA-256 digest of sorted events
- [ ] Exporter recomputes digest; matches on-chain log (TestNet)
- [ ] CI verifies reproducibility on LocalNet

## 📅 Sept 6 (Sat) – End-to-end UX
- [ ] Experimenter dashboard (deploy, fund, pair, finalize, export CSV)
- [ ] Subject dashboard (register, commit/reveal wizard, results)
- [ ] Network toggle defaults to **TestNet** for Pera
- [ ] Full playthrough on TestNet via Pera works, CSV exported

## 📅 Sept 7 (Sun) – Tests & CI
- [ ] Contract unit + scenario tests written
- [ ] CI pipeline runs LocalNet for automated tests
- [ ] CI passes green

## 📅 Sept 8 (Mon) – Dry run & docs
- [ ] Run 3–5 pairs on TestNet
- [ ] Export CSV + `manifest.json` (app-id, digest, contract version)
- [ ] Third party rebuilds CSV/digest from Indexer only
- [ ] README + runbook written

## 📅 Sept 9 (Tue) – Final polish
- [ ] Record demo (wallet playthrough + CSV export)
- [ ] Tag release in repo
- [ ] Archive CI logs + reproducibility bundle
- [ ] Deliver final docs & video
