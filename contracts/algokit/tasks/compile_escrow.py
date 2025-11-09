from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from algosdk.encoding import is_valid_address
from algosdk.v2client.algod import AlgodClient

# Correct path resolution
_here = Path(__file__).resolve()
contracts_dir = _here.parents[2]            # .../<repo>/contracts
repo_root = contracts_dir.parent            # .../<repo>
sys.path.insert(0, str(repo_root))

from contracts.bank_account_escrow import compile_program  # noqa: E402

ARTIFACTS_DIR = contracts_dir / "artifacts"
TEAL_PATH = ARTIFACTS_DIR / "bank_account_escrow.teal"
ADDRESS_PATH = ARTIFACTS_DIR / "bank_account_escrow.address.txt"


def _write_teal() -> str:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    teal = compile_program()
    TEAL_PATH.write_text(teal, encoding="utf-8")
    print(f"Wrote TEAL to {TEAL_PATH}")
    return teal


def _build_algod_client() -> AlgodClient:
    address = os.getenv("ALGOD_ADDRESS")
    token = os.getenv("ALGOD_TOKEN")
    headers_raw = os.getenv("ALGOD_HEADERS")

    if not address or not token:
        print(
            "No active AlgoKit profile or compile endpoint unavailable.\n"
            "Run: algokit localnet start && algokit config set profile=localnet.",
            file=sys.stderr,
        )
        sys.exit(2)

    headers = json.loads(headers_raw) if headers_raw else {}
    return AlgodClient(token, address, headers)


def _derive_address(teal: str) -> str:
    client = _build_algod_client()
    response = client.compile(teal)
    logic_hash = response.get("hash")
    if not (logic_hash and is_valid_address(logic_hash)):
        raise RuntimeError("Algod compile did not return a valid LogicSig address.")
    return logic_hash


def main() -> None:
    teal = _write_teal()
    address = _derive_address(teal)
    ADDRESS_PATH.write_text(address + "\n", encoding="utf-8")
    print(f"Wrote escrow address to {ADDRESS_PATH}")


if __name__ == "__main__":
    main()
