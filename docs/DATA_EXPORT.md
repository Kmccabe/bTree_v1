# DATA_EXPORT

Canonical CSV schema for research exports. Concise, deterministic, and easy to audit.

## Canonical CSV Schema

Columns (in order):
- session_id: Study/session identifier (string).
- appId: Algorand application ID (integer).
- timestamp_utc: ISO-8601 UTC timestamp of the event.
- role: One of S1 | S2 | Admin.
- action: One of opt_in | invest | return | phase | sweep | delete.
- s: Amount invested by S1 (µAlgos; integer; empty if not applicable).
- t: Multiplied amount available to S2 (µAlgos; integer; t = m × s; empty if N/A).
- r: Amount returned by S2 (µAlgos; integer; empty if not applicable).
- payout_s1: Net payout to S1 for this event (µAlgos; integer or 0).
- payout_s2: Net payout to S2 for this event (µAlgos; integer or 0).
- txId: Transaction ID (string).
- phase_before: Phase at event start (0|1|2|3).
- phase_after: Phase after event completes (0|1|2|3).
- address_s1: Registered S1 address (Algorand address string or hashed, see below).
- address_s2: Registered S2 address (Algorand address string or hashed, see below).

Notes:
- Monetary fields are in µAlgos to avoid rounding.
- Empty means not applicable for that action (e.g., r during invest).
- t is derived; store the computed value for reproducibility.

## Example (3 rows)

```csv
session_id,appId,timestamp_utc,role,action,s,t,r,payout_s1,payout_s2,txId,phase_before,phase_after,address_s1,address_s2
tg-001,12345,2024-09-01T12:00:00Z,Admin,phase,,, ,0,0,TXID_PHASE_SET,0,1,ADDR_S1,ADDR_S2
tg-001,12345,2024-09-01T12:05:10Z,S1,invest,1000000,3000000,,0,0,TXID_INVEST,1,2,ADDR_S1,ADDR_S2
tg-001,12345,2024-09-01T12:08:42Z,S2,return,,3000000,1000000,1000000,2500000,TXID_RETURN,2,3,ADDR_S1,ADDR_S2
```

## Config: hash addresses in export

- Option: Hash `address_s1` and `address_s2` using salted SHA-256: `hex(sha256(addr + study_salt))`.
- Keep the salt private and constant per study to allow joins across rows in the same dataset.
- When enabled, replace the address fields’ values with the hashes; column names remain the same.

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

See [INTEGRITY](INTEGRITY.md) for how to verify that a dataset corresponds to on-chain activity (via LoRA links and/or an on-chain finalize digest).

See also [REVIEW_NOTES](REVIEW_NOTES.md) for current gaps and proposed export improvements.
