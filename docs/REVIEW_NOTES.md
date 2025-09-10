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
