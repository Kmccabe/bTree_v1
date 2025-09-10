# DATA_EXPORT

Goal: produce a CSV that is verifiably derived from on-chain events, matching what `/api/export` returns today, with a path to a richer research schema.

## Current CSV (as implemented)

Endpoint: `GET /api/export?appId=<APP_ID>`

Header columns:
- `round`: confirmation round
- `round_time`: UNIX epoch seconds
- `txid`: transaction ID
- `sender`: outer app-call sender
- `event`: decoded first application arg when printable (e.g., `set_phase`, `invest`, `return`)
- `details_json`: minimal JSON map (e.g., `{ "s": 120000 }`, `{ "r": 60000 }`, `{ "new_phase": 2 }`)

Example rows:
```text
round,round_time,txid,sender,event,details_json
27900000,1694358123,ABC...,ADDR_INVESTOR,invest,"{\"s\":120000}"
27900042,1694358188,DEF...,ADDR_TRUSTEE,return,"{\"r\":60000}"
27900050,1694358201,GHI...,ADDR_ADMIN,set_phase,"{\"new_phase\":3}"
```

Notes:
- The CSV lists app-call transactions observed by the Indexer. Inner payments are not serialized into this CSV, but can be inspected via `/api/history` or explorers (LoRA/AlgoExplorer).
- Indexer lag can delay visibility of fresh transactions by 1–2 minutes.

## Planned Extended CSV (research superset)

For research exports, we aim to extend rows to include derived values and roles:
- `app_id`, `s1_addr`, `s2_addr`, `id_s1`, `id_s2`, `E1`, `E2`, `m`, `UNIT`,
- `s`, `t` (where `t = m × s`), `r`,
- `payout_s1`, `payout_s2`,
- `tx_invest`, `round_invest`, `tx_return`, `round_return`, `ended_at`.

Status: not implemented in `/api/export` yet. See REVIEW_NOTES for gaps and proposed approach (join of `/api/pair`, `/api/history`, and decoded inner payments).

## Privacy Toggle: Hash addresses

When sharing datasets, you may hash addresses (e.g., SHA-256 of `addr + study_salt`). Keep the salt private and document the method.

## Integrity

See `docs/INTEGRITY.md` for how to verify that a dataset corresponds to on-chain activity (via LoRA links and/or an on-chain finalize digest).
