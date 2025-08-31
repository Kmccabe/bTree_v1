import os, base64
from pathlib import Path

from algosdk.v2client.algod import AlgodClient
try:
    # v2+
    from algosdk.transaction import (
        StateSchema,
        OnComplete,
        ApplicationCreateTxn,
        wait_for_confirmation,
    )
except ImportError:
    # v1.x fallback
    from algosdk.future.transaction import (
        StateSchema,
        OnComplete,
        ApplicationCreateTxn,
        wait_for_confirmation,
    )

try:
    from algosdk.kmd import KMDClient  # preferred location
except ImportError:
    from algosdk.v2client.kmd import KMDClient  # fallback (rare)

# Robust repo root detection (works whether this test lives in contracts/ or tests/contract/)
HERE = Path(__file__).resolve()
if "contracts" in HERE.parts:
    REPO = HERE.parents[1]
elif "tests" in HERE.parts and "contract" in HERE.parts:
    REPO = HERE.parents[2]
else:
    REPO = HERE.parents[1]

ARTIFACTS = REPO / "artifacts"
APPROVAL_PATH = ARTIFACTS / "approval.teal"
CLEAR_PATH = ARTIFACTS / "clear.teal"

ALGOD_ADDR = os.getenv("ALGOD_LOCAL", "http://localhost:4001")
ALGOD_TOKEN = os.getenv("ALGOD_LOCAL_TOKEN", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
KMD_ADDR = os.getenv("KMD_LOCAL", "http://localhost:4002")
KMD_TOKEN = os.getenv("KMD_LOCAL_TOKEN", ALGOD_TOKEN)  # usually same in sandbox

def get_algod() -> AlgodClient:
    return AlgodClient(ALGOD_TOKEN, ALGOD_ADDR, headers={"X-Algo-API-Token": ALGOD_TOKEN})

def get_kmd() -> KMDClient:
    return KMDClient(KMD_TOKEN, KMD_ADDR)

def _first_wallet_handle(kmd: KMDClient) -> tuple[str, str]:
    # algosdk versions differ: some return {"wallets": [...]}, others return a plain list
    wl = kmd.list_wallets()
    wallets = wl.get("wallets", []) if isinstance(wl, dict) else wl
    assert wallets, "No KMD wallets found in LocalNet"
    wallet_id = wallets[0]["id"]
    for pw in ["", "a", "testpassword"]:
        try:
            handle = kmd.init_wallet_handle(wallet_id, pw)
            kmd.release_wallet_handle(handle)
            return wallet_id, pw
        except Exception:
            continue
    raise AssertionError("Could not unlock KMD wallet with '', 'a', or 'testpassword'")

def _get_signing_key(kmd: KMDClient, wallet_id: str, pw: str) -> tuple[str, bytes]:
    handle = kmd.init_wallet_handle(wallet_id, pw)
    try:
        keys = kmd.list_keys(handle)
        addr = keys[0] if keys else kmd.generate_key(handle)
        sk = kmd.export_key(handle, pw, addr)
        return addr, sk
    finally:
        try:
            kmd.release_wallet_handle(handle)
        except Exception:
            pass

def test_create_app_on_localnet():
    assert APPROVAL_PATH.exists() and CLEAR_PATH.exists(), "Run: python contracts/build.py"

    algod = get_algod()
    kmd = get_kmd()

    # Compile TEAL via algod
    approval_src = APPROVAL_PATH.read_text()
    clear_src = CLEAR_PATH.read_text()
    compiled_approval = algod.compile(approval_src)
    compiled_clear = algod.compile(clear_src)
    approval_prog = base64.b64decode(compiled_approval["result"])
    clear_prog = base64.b64decode(compiled_clear["result"])

    # KMD account (local-only)
    wallet_id, pw = _first_wallet_handle(kmd)
    sender, sk = _get_signing_key(kmd, wallet_id, pw)

    # Build, sign, send
    sp = algod.suggested_params()
    txn = ApplicationCreateTxn(
        sender=sender,
        sp=sp,
        on_complete=OnComplete.NoOpOC,
        approval_program=approval_prog,
        clear_program=clear_prog,
        # approval uses 2 globals (uints) + 1 global bytes value
        global_schema=StateSchema(num_uints=2, num_byte_slices=1),
        local_schema=StateSchema(0, 0),
        note=b"bTree v1 localnet create",
    )
    txid = algod.send_transaction(txn.sign(sk))
    result = wait_for_confirmation(algod, txid, 20)
    appid = result.get("application-index")
    assert appid and appid > 0, f"no app id in result: {result}"
    print("LocalNet App ID:", appid)
