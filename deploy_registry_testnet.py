# deploy_registry_testnet.py
# Minimal TestNet deploy for the bTree Registry app.
# - Reads TEAL/ABI artifacts from contracts/artifacts/
# - Connects to TestNet (Algonode)
# - Creates the app and bootstraps it in the create txn (cap_total)
# - Prints app_id and app escrow address
#
# Usage (PowerShell):
#   # set admin mnemonic (or you will be prompted)
#   $env:ALGOD_DEPLOY_MNEMONIC = "<25 words>"
#   # optional overrides:
#   $env:ALGOD_URL="https://testnet-api.algonode.cloud"
#   $env:ALGOD_TOKEN=""
#   # run:
#   python deploy_registry_testnet.py --cap 3
#
# After deploy: fund the printed app address with a few ALGO on TestNet.

import argparse
import base64
import json
import os
import sys
from pathlib import Path

from algosdk import account, encoding, logic
from algosdk.abi import ABIType, Method
from algosdk.v2client import algod
from algosdk import transaction as tx
from algosdk import mnemonic as algom

ART_DIR = Path("contracts/artifacts")
APPROVAL_TEAL_PATH = ART_DIR / "registry_approval.teal"
CLEAR_TEAL_PATH = ART_DIR / "registry_clear.teal"
CONTRACT_JSON_PATH = ART_DIR / "registry.json"

DEFAULT_ALGOD_URL = os.environ.get("ALGOD_URL", "https://testnet-api.algonode.cloud")
DEFAULT_ALGOD_TOKEN = os.environ.get("ALGOD_TOKEN", "")

def load_text(p: Path) -> str:
    if not p.exists():
        sys.exit(f"Missing artifact: {p}")
    return p.read_text(encoding="utf-8")

def compile_teal(client: algod.AlgodClient, teal_src: str) -> bytes:
    resp = client.compile(teal_src)
    return base64.b64decode(resp["result"])

def get_admin_acct(env_var: str = "ALGOD_DEPLOY_MNEMONIC") -> tuple[str, str]:
    m = os.environ.get(env_var, "").strip()
    if not m:
        print(f"{env_var} not set. Paste your 25-word admin mnemonic (TestNet), then Enter:")
        try:
            m = input("mnemonic> ").strip()
        except KeyboardInterrupt:
            sys.exit("\nAborted.")
    try:
        sk = algom.to_private_key(m)
        addr = account.address_from_private_key(sk)
        return sk, addr
    except Exception as e:
        sys.exit(f"Invalid mnemonic: {e}")

def method_selector(signature: str) -> bytes:
    # e.g., "bootstrap(uint64)"
    return Method.from_signature(signature).get_selector()

def encode_u64(n: int) -> bytes:
    return ABIType.from_string("uint64").encode(n)

def connect_algod(url: str, token: str) -> algod.AlgodClient:
    print(f"Connecting to Algod: {url}")
    return algod.AlgodClient(token, url)

def wait_confirm(client: algod.AlgodClient, txid: str, timeout: int = 10):
    return tx.wait_for_confirmation(client, txid, timeout)

def deploy(url: str, token: str, cap_total: int):
    # 1) Connect + artifacts
    client = connect_algod(url, token)
    approval_teal = load_text(APPROVAL_TEAL_PATH)
    clear_teal = load_text(CLEAR_TEAL_PATH)

    # 2) Admin acct
    sk, addr = get_admin_acct()
    print(f"Admin: {addr}")

    # 3) Compile TEAL → program bytes
    approval_prog = compile_teal(client, approval_teal)
    clear_prog = compile_teal(client, clear_teal)
    print("Compiled approval & clear TEAL")

    # 4) Suggested params
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000  # create txn (no boxes here)

    # 5) Build ApplicationCreateTxn with bootstrap(cap_total) app_args
    sel_bootstrap = method_selector("bootstrap(uint64)void")
    args_bootstrap = [sel_bootstrap, encode_u64(cap_total)]


    global_schema = tx.StateSchema(num_uints=4, num_byte_slices=1)  # ints: is_open, cap_total, registered_count, micro_reward; bytes: admin_addr
    local_schema = tx.StateSchema(0, 0)

    create_txn = tx.ApplicationCreateTxn(
        sender=addr,
        sp=sp,
        on_complete=tx.OnComplete.NoOpOC,
        approval_program=approval_prog,
        clear_program=clear_prog,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=args_bootstrap,
    )

    stx = create_txn.sign(sk)
    txid = client.send_transaction(stx)
    print(f"Create tx sent: {txid}")
    res = wait_confirm(client, txid, timeout=20)
    app_id = res["application-index"]
    app_addr = logic.get_application_address(app_id)

    print("\n=== Deployed Registry on TestNet ===")
    print(f"app_id:     {app_id}")
    print(f"app_addr:   {app_addr}")
    print("\nNext:")
    print("  1) Fund the app escrow so rewards can be paid (e.g., 5 ALGO):")
    print("     - From Pera (TestNet) send 5 ALGO to the app_addr above")
    print("  2) (Optional) Raise reward via admin_set_reward using your UI or a small script")
    print("  3) In the frontend .env.local, set:")
    print("       VITE_ALGOD_URL=https://testnet-api.algonode.cloud")
    print("       VITE_ALGOD_TOKEN=")
    print("     then restart npm run dev and use this app_id on /subject/register & /subject/link")

def main():
    parser = argparse.ArgumentParser(description="Deploy bTree Registry to Algorand TestNet")
    parser.add_argument("--cap", type=int, default=3, help="Initial cap_total for registrations (default: 3)")
    parser.add_argument("--url", type=str, default=DEFAULT_ALGOD_URL, help="Algod URL (default: TestNet Algonode)")
    parser.add_argument("--token", type=str, default=DEFAULT_ALGOD_TOKEN, help="Algod token (default: empty for Algonode)")
    args = parser.parse_args()

    # Sanity: artifacts exist?
    for p in (APPROVAL_TEAL_PATH, CLEAR_TEAL_PATH, CONTRACT_JSON_PATH):
        if not p.exists():
            sys.exit(f"Artifact missing: {p} — run: python -m contracts.registry.compile")

    try:
        deploy(args.url, args.token, args.cap)
    except Exception as e:
        # Try to show helpful node error
        print(f"\nERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
