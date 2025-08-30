# INTEGRITY

To prove the CSV exactly matches on-chain events:

1) During `finalize()`:
   - The experimenter submits a transaction that includes a SHA-256 digest of the canonical event JSON lines, in order.
   - Store this as a global key `fd` (finalize_digest) in app global state.

2) To verify later:
   - Export events from indexer → canonicalize the JSON lines → compute SHA-256.
   - Compare with the on-chain `fd` value. They must match exactly.

This allows reviewers to independently reconstruct and verify your dataset using only:
- Network (TestNet)
- App ID
