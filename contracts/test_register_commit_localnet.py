import os, base64, hashlib
from pathlib import Path

from algosdk.v2client.algod import AlgodClient
try:
    # SDK v2+
    from algosdk.transaction import (
        StateSchema, OnComplete,
        ApplicationCreateTxn, ApplicationOptInTxn, ApplicationNoOpTxn,
        wait_for_confirmation,
    )
except ImportError:
    # SDK v1 fallback
    from algosdk.future.transaction import (
        StateSchema, OnComplete,
        ApplicationCreateTxn, ApplicationOptInTxn, ApplicationNoOpTxn,
        wait_for_confirmation,
    )

try:
    from algosdk.kmd import KMDClient
except ImportError:
    from algosdk.v2client.kmd import KMDClient

HERE = Path(__file__).resolve()
REPO = HERE.parents[1]
ART = REPO / "artifacts"

ALGOD_ADDR = os.getenv("ALGOD_LOCAL", "http://localhost:4001")
ALGOD_TOKEN = os.getenv("ALGOD_LOCAL_TOKEN", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
KMD_ADDR = os.getenv("KMD_LOCAL", "http://localhost:4002")
KMD_TOKEN = os.getenv("KMD_LOCAL_TOKEN", ALGOD_TOKEN)

def algod() -> AlgodClient:
    return AlgodClient(ALGOD_TOKEN, ALGOD_ADDR, headers={"X-Algo-API-Token": ALGOD_TOKEN})

def kmd() -> KMDClient:
    return KMDClient(KMD_TOKEN, KMD_ADDR)

def _wallet_and_key():
    k = kmd()
    wallets = k.list_wallets()
    wl = wallets["wallets"] if isinstance(wallets, dict) else wallets
    assert wl, "No KMD wallets found"
    wid = wl[0]["id"] if isinstance(wl[0], dict) else wl[0]
    for pw in ["", "a", "testpassword"]:
        try:
            h = k.init_wallet_handle(wid, pw)
            try:
                keys = k.list_keys(h)
                addr = keys[0] if keys else k.generate_key(h)
                sk = k.export_key(h, pw, addr)
                return addr, sk, pw, wid
            finally:
                k.release_wallet_handle(h)
        except Exception:
            continue
    raise AssertionError("Could not unlock KMD wallet with '', 'a', or 'testpassword'")

def _b64(bs: bytes) -> str:
    return base64.b64encode(bs).decode()

def test_register_commit_reveal_on_localnet():
    # compile TEAL and create app
    appr_src = (ART / "approval.teal").read_text()
    clr_src = (ART / "clear.teal").read_text()
    approval = base64.b64decode(algod().compile(appr_src)["result"])
    clear = base64.b64decode(algod().compile(clr_src)["result"])

    sender, sk, pw, wid = _wallet_and_key()
    sp = algod().suggested_params()

    # Globals: phase,n (uints) + exp,fd (bytes) → 2/2
    # Locals: r,v,pay (uints) + c (bytes) → 3/1
    gschema = StateSchema(num_uints=2, num_byte_slices=2)
    lschema = StateSchema(num_uints=3, num_byte_slices=1)

    create = ApplicationCreateTxn(
        sender=sender, sp=sp, on_complete=OnComplete.NoOpOC,
        approval_program=approval, clear_program=clear,
        global_schema=gschema, local_schema=lschema,
        note=b"bTree v1 localnet create",
    )
    txid = algod().send_transaction(create.sign(sk))
    res = wait_for_confirmation(algod(), txid, 20)
    app_id = res.get("application-index")
    assert app_id and app_id > 0

    # Opt-in
    sp = algod().suggested_params()
    optin = ApplicationOptInTxn(sender=sender, sp=sp, index=app_id)
    txid = algod().send_transaction(optin.sign(sk))
    wait_for_confirmation(algod(), txid, 10)

    # reg
    sp = algod().suggested_params()
    reg = ApplicationNoOpTxn(sender=sender, sp=sp, index=app_id, app_args=[b"reg"])
    txid = algod().send_transaction(reg.sign(sk))
    wait_for_confirmation(algod(), txid, 10)

    # commit (hash = sha256(value + b"|" + salt))
    salt = b"localnet-salt"
    value = b"1"
    commit_hash = hashlib.sha256(value + b"|" + salt).digest()
    sp = algod().suggested_params()
    com = ApplicationNoOpTxn(sender=sender, sp=sp, index=app_id, app_args=[b"commit", commit_hash])
    txid = algod().send_transaction(com.sign(sk))
    wait_for_confirmation(algod(), txid, 10)

    # reveal (pass value and salt; contract recomputes and checks)
    sp = algod().suggested_params()
    rev = ApplicationNoOpTxn(sender=sender, sp=sp, index=app_id, app_args=[b"reveal", value, salt])
    txid = algod().send_transaction(rev.sign(sk))
    wait_for_confirmation(algod(), txid, 10)

    # verify local state: 'v' (revealed flag) == 1
    acct = algod().account_info(sender)
    als = next(x for x in acct.get("apps-local-state", []) if x.get("id") == app_id)
    kv = als.get("key-value", [])
    v_key = _b64(b"v")
    found = [item for item in kv if item.get("key") == v_key]
    assert found, "no 'v' key found"
    assert found[0]["value"].get("uint") == 1, f"expected v=1, got {found[0]['value']}"
