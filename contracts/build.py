# contracts/build.py
import json, hashlib
from pathlib import Path
from pyteal import compileTeal, Mode
from trust_game_app_scaffold import approval_program, clear_state_program

ARTIFACTS = Path(__file__).resolve().parent.parent / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)

def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def main():
    approval_teal = compileTeal(approval_program(), mode=Mode.Application, version=8)
    clear_teal = compileTeal(clear_state_program(), mode=Mode.Application, version=8)

    (ARTIFACTS / "approval.teal").write_text(approval_teal, encoding="utf-8")
    (ARTIFACTS / "clear.teal").write_text(clear_teal, encoding="utf-8")

    manifest = {
        "contract": "bTree v1 — Trust Game (scaffold)",
        "teal_version": 8,
        "artifacts": {
            "approval": {"file": "approval.teal", "sha256": sha256_hex(approval_teal)},
            "clear": {"file": "clear.teal", "sha256": sha256_hex(clear_teal)},
        },
    }
    (ARTIFACTS / "contract.manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Wrote artifacts to", ARTIFACTS)

if __name__ == "__main__":
    main()
