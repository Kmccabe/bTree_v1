
"""
Trust Game App — Skeleton (Algorand Python / PyTeal-compatible pseudocode)

Notes:
- Wallet flows will be on TestNet via Pera; LocalNet is for SDK tests.
- Methods are stubs; fill logic per daily plan.
"""

# Placeholder: replace with actual Algorand Python ("algopy") or PyTeal implementation
class TrustGameApp:
    def create_experiment(self, E: int, m: int, deadline_cfg: dict):
        """Initialize experiment parameters. TODO: boxes, globals, permissions."""
        ...

    def register_subject(self, subject_tag: bytes):
        """Register a wallet (one-wallet-one-seat). TODO: enforce uniqueness and log event."""
        ...

    def pair(self, address_a: str, address_b: str):
        """Experimenter-only pairing. TODO: role assignment, box mapping."""
        ...

    def commit_choice(self, role: str, commitment_hash: bytes):
        """Store commitment for A or B. TODO: per-pair box state + log."""
        ...

    def reveal_choice(self, role: str, value: int, salt: bytes):
        """Verify commitment and store value. TODO: hash check + ranges + log."""
        ...

    def settle(self, pair_id: int):
        """Compute payoffs; optional inner payments. TODO: box update + logs."""
        ...

    def finalize(self):
        """Emit canonical digest over sorted event tuples. TODO."""
        ...
