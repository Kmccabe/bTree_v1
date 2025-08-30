# DATA_EXPORT

Goal: produce a CSV that is **verifiably** derived from on-chain events.

## Options considered
1) **Tx notes**: write canonical JSON lines into the `note` field on each relevant app call.
2) **Boxes**: store per-subject/per-pair rows and read via indexer (heavier for frontends).

### Decision (MVP)
- Use **Tx notes** for: `register`, `commit`, `reveal`, `settle`, `finalize`.
- Each note is a compact JSON line with keys:
  - `e`: event type (string)
  - `ts`: UNIX epoch seconds (block time)
  - `a`: actor address (where applicable)
  - `p`: pair_id (where applicable)
  - `d`: minimal event-specific fields (e.g., commitment hash)

These are easy to fetch from indexer by app-id and guaranteed immutable.

## CSV shape
Columns (superset; some blank depending on event):
- `round`, `txid`, `ts`, `event`, `addr`, `pair_id`, `details_json`

A serverless endpoint `/api/export?appId=...` will:
- Query indexer for app calls
- Filter those with our JSON note prefix (e.g., `{"e":"...`)
- Emit CSV (one row per event)

## Integrity
`finalize()` will compute an ordered digest over all event JSON lines; see INTEGRITY.md.
