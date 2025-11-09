"""
Compile helper for the bank-account escrow LogicSig.

Usage:
    python contracts/escrow_compile.py

Artifacts produced (under contracts/artifacts/):
    - bank_account_escrow.teal        # TEAL v8 source
    - bank_account_escrow.address.txt # Escrow address derived from the compiled program

The script first tries to shell out to `goal clerk compile` (preferred so it
works fully offline). If `goal` is unavailable it falls back to the Algod
compile endpoint, using environment variables:
    ALGOD_ADDRESS, ALGOD_TOKEN, (optional) ALGOD_HEADERS as JSON.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

from algosdk.encoding import is_valid_address
from algosdk.v2client.algod import AlgodClient

from bank_account_escrow import compile_program

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
TEAL_PATH = ARTIFACTS_DIR / "bank_account_escrow.teal"
ADDRESS_PATH = ARTIFACTS_DIR / "bank_account_escrow.address.txt"


def _write_teal() -> None:
    ARTIFACTS_DIR.mkdir(exist_ok=True)
    teal = compile_program()
    TEAL_PATH.write_text(teal, encoding="utf-8")
    print(f"Wrote TEAL to {TEAL_PATH}")


def _derive_address_via_goal() -> Optional[str]:
    goal_path = "goal"
    try:
        result = subprocess.run(
            [goal_path, "clerk", "compile", str(TEAL_PATH)],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None
    except subprocess.CalledProcessError as exc:
        print("goal clerk compile failed:\n", exc.stderr or exc.stdout, file=sys.stderr)
        return None

    for line in result.stdout.splitlines():
        line = line.strip()
        if line.lower().startswith("address:") or line.lower().startswith("addr:"):
            maybe_addr = line.split(":", 1)[1].strip()
            if is_valid_address(maybe_addr):
                return maybe_addr
    return None


def _derive_address_via_algod() -> Optional[str]:
    algod_address = os.getenv("ALGOD_ADDRESS")
    algod_token = os.getenv("ALGOD_TOKEN")
    if not algod_address or not algod_token:
        return None

    headers = {}
    if os.getenv("ALGOD_HEADERS"):
        headers = json.loads(os.environ["ALGOD_HEADERS"])

    client = AlgodClient(algod_token, algod_address, headers)
    teal_source = TEAL_PATH.read_text(encoding="utf-8")
    try:
        compile_response = client.compile(teal_source)
    except Exception as exc:  # pylint: disable=broad-except
        print(f"algod compile failed: {exc}", file=sys.stderr)
        return None

    algo_address = compile_response.get("hash")
    if algo_address and is_valid_address(algo_address):
        return algo_address
    return None


def _write_address(address: str) -> None:
    ADDRESS_PATH.write_text(address + "\n", encoding="utf-8")
    print(f"Wrote escrow address to {ADDRESS_PATH}")


def main() -> None:
    _write_teal()

    address = _derive_address_via_goal()
    if not address:
        address = _derive_address_via_algod()

    if not address:
        print(
            "WARNING: Unable to derive escrow address. "
            "Ensure `goal` is installed or set ALGOD_* env vars.",
            file=sys.stderr,
        )
        return

    _write_address(address)


if __name__ == "__main__":
    main()
