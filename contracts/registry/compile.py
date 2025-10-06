# contracts/registry/compile.py
from __future__ import annotations

import json
from pathlib import Path

from pyteal import *

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def _write(path: Path, data: str | bytes) -> None:
    if isinstance(data, bytes):
        path.write_bytes(data)
    else:
        path.write_text(data, encoding="utf-8")


def main() -> None:
    """
    Compile the bTree Registry contract to TEAL + contract JSON.

    Supports two shapes of contracts/registry/registry.py:
      1) get_router() -> Router   (preferred)
      2) approval_program(), clear_state_program() -> Expr
    """
    # Lazy import to avoid import-time side effects
    try:
        from .registry import get_router  # type: ignore
        router = get_router()  # Router
        # PyTeal >= 0.24
        approval_expr, clear_expr, contract_obj = router.compile_program(
            version=8, optimize=OptimizeOptions(scratch_slots=True)
        )
        approval_teal = (
            approval_expr
            if isinstance(approval_expr, str)
            else compileTeal(approval_expr, Mode.Application, version=8)
        )
        clear_teal = (
            clear_expr
            if isinstance(clear_expr, str)
            else compileTeal(clear_expr, Mode.Application, version=8)
        )
        contract_json = json.dumps(contract_obj.dictify(), indent=2)
    except ImportError:
        # Fallback to plain functions
        from .registry import approval_program, clear_state_program  # type: ignore

        approval_expr = approval_program()
        clear_expr = clear_state_program()
        approval_teal = compileTeal(approval_expr, Mode.Application, version=8)
        clear_teal = compileTeal(clear_expr, Mode.Application, version=8)
        # Minimal ABI artifact when no Router present
        contract_json = json.dumps(
            {"name": "bTree Registry (no-router)", "networks": {}, "methods": []}, indent=2
        )

    _write(ARTIFACTS_DIR / "registry_approval.teal", approval_teal)
    _write(ARTIFACTS_DIR / "registry_clear.teal", clear_teal)
    _write(ARTIFACTS_DIR / "registry.json", contract_json)

    print(f"Wrote: {ARTIFACTS_DIR / 'registry_approval.teal'}")
    print(f"Wrote: {ARTIFACTS_DIR / 'registry_clear.teal'}")
    print(f"Wrote: {ARTIFACTS_DIR / 'registry.json'}")


if __name__ == "__main__":
    main()
