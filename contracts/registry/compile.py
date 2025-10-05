from __future__ import annotations

import json
from pathlib import Path

from pyteal import Mode, compileTeal

try:\n    from .registry import get_router\nexcept ImportError:\n    from registry import get_router


def main() -> None:
    router = get_router()
    approval, clear, contract = router.compile_program(version=8)

    artifacts_dir = Path(__file__).resolve().parents[1] / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    approval_path = artifacts_dir / "registry_approval.teal"
    clear_path = artifacts_dir / "registry_clear.teal"
    contract_path = artifacts_dir / "registry_contract.json"

    approval_path.write_text(compileTeal(approval, mode=Mode.Application, version=8) + "\n")
    clear_path.write_text(compileTeal(clear, mode=Mode.Application, version=8) + "\n")
    contract_path.write_text(json.dumps(contract.dictify(), indent=2) + "\n")

    print(f"Wrote approval TEAL -> {approval_path}")
    print(f"Wrote clear TEAL    -> {clear_path}")
    print(f"Wrote app spec      -> {contract_path}")
    print("Box prefixes in use: profile:, payment_cipher:, link:, link_pending:")


if __name__ == "__main__":
    main()

