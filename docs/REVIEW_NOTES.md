# Review Notes

## Inventory

| Path | Exists |
| --- | --- |
| docs/README.md | YES |
| docs/API_REFERENCE.md | YES |
| docs/TROUBLESHOOTING.md | YES |
| docs/DATA_EXPORT.md | YES |
| docs/INTEGRITY.md | YES |
| tests/PHASE_2_TESTING.md | YES |
| tests/manual/SMOKE.md | YES |
| archive/CHECKLIST-archived.md | YES |
| archive/RELEASE_NOTES-archived.md | YES |

## Next edits proposed

- docs/README.md

## Done in this step

- Added Index and Glossary to docs/README.md; verified code fence language tags.
- Fixed intra-docs links: converted plain reference to [INTEGRITY](INTEGRITY.md) and added link to [REVIEW_NOTES](REVIEW_NOTES.md) in DATA_EXPORT.md.
- Verified anchors exist: API_REFERENCE.md#environment-variables, TROUBLESHOOTING.md#network-and-api-issues, TROUBLESHOOTING.md#getting-help.
- Left external links as-is (not in docs/): ../README.md, ../frontend/docs/*, ../tests/*.

## Consistency audit — legacy terms

- Scan scope: docs/*.md
- Legacy variables: none found (no `y` for return; no single `E` used where `E1`/`E2` intended).
- Phases: labeled as 0–3 consistently (Registration, Invest, Return, Done).
- Canonical symbols present where applicable: `UNIT`, `m`, `s`, `t = m × s`, `r`, `E1`, `E2`.
- Code fences: left unchanged when showing real API payloads or commands.

Actions taken:
- No term replacements required within docs/; all occurrences already canonical.
- If future edits introduce non-canonical terms, align to: phases 0–3; `E1`, `E2`, `s`, `t = m × s`, `r`, `UNIT`, `m`.

## API diffs (first 3)

- Endpoints checked (top to bottom):
  1) GET /api/health → exists at `frontend/api/health.ts`
  2) GET /api/params → exists at `frontend/api/params.ts`
  3) POST /api/compile → exists at `frontend/api/compile.ts`

- Observations vs docs:
  - health: Implementation does not enforce method; docs list GET. Behavior still matches (200 with `{ ok, message }`).
  - params: Implementation does not enforce method; docs list GET. Success returns Algod params JSON; 500 on failure → matches.
  - compile: Implementation enforces POST (405 for others), requires JSON body `{ source: string }`, forwards Algod JSON with 200 on ok, 400 otherwise; 500 on exceptions → matches docs.

- Action: No doc changes required for these three; recorded non-enforced method note for health/params.

## API diffs (remaining)

- Endpoints checked:
  4) POST /api/submit → `frontend/api/submit.ts`
  5) GET /api/pending → `frontend/api/pending.ts`
  6) GET /api/account → `frontend/api/account.ts`
  7) GET /api/pair → `frontend/api/pair.ts`
  8) GET /api/local → `frontend/api/local.ts`
  9) GET /api/history → `frontend/api/history.ts`
 10) GET /api/export → `frontend/api/export.ts`

- Differences and updates:
  - submit: Returns 400 for Algod non-ok responses in addition to missing input → doc updated to note forwarded Algod errors at 400.
  - pair: Forwards Algod non-200 status; returns 502 when Algod returns non-JSON → doc updated to include proxy forwarding and 502 case.
  - local: Forwards Algod non-200 status; returns 502 when Algod returns non-JSON → doc updated similarly.
- pending/account/history/export: Docs already aligned with implementation (methods, queries, responses, examples); no changes needed.

## Docs lint tooling (suggested)

- Suggested scripts (docs-only; do not add to package.json yet):
  - markdownlint: `npx markdownlint "docs/**/*.md"`
  - cspell: `npx cspell --no-progress "docs/**/*.md"`
- Configs added in repo root:
  - `.markdownlint.json`: line length 120, no trailing spaces (hard breaks allowed), first-line heading relaxed.
  - `cspell.json`: added domain words (Algorand, LoRA, microAlgos, appId, etc.).
- Notes: Optionally extend the commands to include `tests/**/*.md` once docs pass cleanly.
