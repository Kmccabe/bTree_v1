import base64
import json
import os
import pathlib
from contextlib import contextmanager
from typing import Callable, Dict, Iterable, Sequence, Tuple

import pytest
from algosdk import account, encoding as enc, logic, mnemonic
from algosdk.abi import ABIType, Contract, Method
from algosdk.atomic_transaction_composer import (
    AccountTransactionSigner,
    AtomicTransactionComposer,
)
from algosdk.error import AlgodHTTPError
from algosdk import transaction as tx
from algosdk.v2client import algod as algod_v2

# -----------------------
# Environment
# -----------------------
ALGOD_URL = os.environ.get("ALGOD_URL", "http://localhost:4001")
ALGOD_TOKEN = os.environ.get("ALGOD_TOKEN", "a" * 64)

# -----------------------
# Ensure fresh artifacts
# -----------------------
@pytest.fixture(scope="session", autouse=True)
def _compile_registry_artifacts():
    """Compile TEAL + ABI JSON before the test session so artifacts are fresh."""
    from contracts.registry import compile as reg_compile
    reg_compile.main()
    yield

# -----------------------
# Load ABI & TEAL from artifacts
# -----------------------
CONTRACT_PATH = pathlib.Path("contracts/artifacts/registry.json")
APPROVAL_PATH = pathlib.Path("contracts/artifacts/registry_approval.teal")
CLEAR_PATH    = pathlib.Path("contracts/artifacts/registry_clear.teal")

CONTRACT = Contract.from_json(CONTRACT_PATH.read_text())
APPROVAL_TEAL = APPROVAL_PATH.read_text()
CLEAR_TEAL    = CLEAR_PATH.read_text()

# -----------------------
# Client helpers
# -----------------------
def get_algod() -> algod_v2.AlgodClient:
    return algod_v2.AlgodClient(ALGOD_TOKEN, ALGOD_URL)

def compile_teal(client: algod_v2.AlgodClient, teal_source: str) -> bytes:
    resp = client.compile(teal_source)
    return base64.b64decode(resp["result"])

def app_address(app_id: int) -> str:
    return logic.get_application_address(app_id)

# -----------------------
# ABI helpers
# -----------------------
def method_by_name(name: str) -> Method:
    return CONTRACT.get_method_by_name(name)

def call_abi(
    client: algod_v2.AlgodClient,
    sk: str,
    app_id: int,
    method_name: str,
    args: list,
    boxes: Iterable[Tuple[int, bytes]] | None = None,
    fee: int | None = None,
) -> str:
    sender = account.address_from_private_key(sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    boxes_list = list(boxes or [])
    if fee is not None:
        sp.fee = fee
    else:
        sp.fee = 1000 + 2000 * len(boxes_list)
    atc = AtomicTransactionComposer()
    signer = AccountTransactionSigner(sk)
    atc.add_method_call(
        app_id=app_id,
        method=method_by_name(method_name),
        sender=sender,
        sp=sp,
        signer=signer,
        method_args=args,       # plain Python args (ATC ABI-encodes)
        boxes=boxes_list,
    )
    result = atc.execute(client, 4)
    return result.tx_ids[0]

# -----------------------
# Address & box key helpers
# -----------------------
def addr_bytes(addr: str) -> bytes:
    return enc.decode_address(addr)

def b_profile(ab: bytes) -> bytes:
    return b"profile:" + ab

def b_payment_cipher(ab: bytes) -> bytes:
    return b"payment_cipher:" + ab

def b_link(ab: bytes) -> bytes:
    return b"link:" + ab

def b_link_pending(ab: bytes) -> bytes:
    return b"link_pending:" + ab

def abi_app_args(method_name: str, values: Sequence) -> list[bytes]:
    method = method_by_name(method_name)
    if len(values) != len(method.args):
        raise ValueError(f"Argument count mismatch for {method_name}")
    encoded = [method.get_selector()]
    for arg, value in zip(method.args, values):
        arg_type = arg.type
        if isinstance(arg_type, str):
            abi_type = ABIType.from_string(arg_type)
        else:
            abi_type = arg_type
        encoded.append(abi_type.encode(value))
    return encoded

# -----------------------
# Funding & balances
# -----------------------
def create_account() -> Tuple[str, str]:
    sk, addr = account.generate_account()
    return sk, addr

def fund(client: algod_v2.AlgodClient, src_sk: str, dest_addr: str, amount: int) -> None:
    if amount <= 0:
        return
    src_addr = account.address_from_private_key(src_sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000
    txn = tx.PaymentTxn(src_addr, sp, dest_addr, amount)
    stxn = txn.sign(src_sk)
    client.send_transaction(stxn)
    tx.wait_for_confirmation(client, stxn.get_txid(), 4)

def get_balance(client: algod_v2.AlgodClient, addr: str) -> int:
    return client.account_info(addr)["amount"]

@contextmanager
def balance_delta(client: algod_v2.AlgodClient, addr: str) -> Callable[[], int]:
    before = get_balance(client, addr)
    yield lambda: get_balance(client, addr) - before

# -----------------------
# Read state & boxes
# -----------------------
def read_global_state(client: algod_v2.AlgodClient, app_id: int) -> Dict[str, int | bytes]:
    info = client.application_info(app_id)
    state_array = info["params"].get("global-state", [])
    out: Dict[str, int | bytes] = {}
    for item in state_array:
        key = base64.b64decode(item["key"]).decode()
        val = item["value"]
        if val["type"] == 1:
            out[key] = base64.b64decode(val["bytes"])
        else:
            out[key] = val["uint"]
    return out

def box_get(client: algod_v2.AlgodClient, app_id: int, key: bytes) -> bytes | None:
    try:
        data = client.application_box_by_name(app_id, key)
        return base64.b64decode(data["value"])
    except AlgodHTTPError:
        return None

def box_exists(client: algod_v2.AlgodClient, app_id: int, key: bytes) -> bool:
    return box_get(client, app_id, key) is not None

# -----------------------
# Deploy & bootstrap
# -----------------------
def deploy_registry_app(client: algod_v2.AlgodClient, admin_sk: str, cap_total: int = 2) -> int:
    approval = compile_teal(client, APPROVAL_TEAL)
    clear    = compile_teal(client, CLEAR_TEAL)
    sender = account.address_from_private_key(admin_sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000
    bootstrap = method_by_name("bootstrap")
    txn = tx.ApplicationCreateTxn(
        sender=sender,
        sp=sp,
        on_complete=tx.OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=clear,
        global_schema=tx.StateSchema(4, 1),  # is_open, cap_total, registered_count, micro_reward; admin_addr bytes
        local_schema=tx.StateSchema(0, 0),
        app_args=[bootstrap.get_selector(), ABIType.from_string("uint64").encode(cap_total)],
    )
    stxn = txn.sign(admin_sk)
    client.send_transaction(stxn)
    res = tx.wait_for_confirmation(client, stxn.get_txid(), 4)
    return res["application-index"]

def bootstrap_registry(client: algod_v2.AlgodClient, app_id: int, admin_sk: str, cap: int = 2) -> str:
    return call_abi(client, admin_sk, app_id, "bootstrap", [cap])
# -----------------------
# Pytest fixtures
# -----------------------
@pytest.fixture(scope="session")
def algod():
    return get_algod()

@pytest.fixture(scope="session")
def dispenser():
    m = os.environ.get("ALGOD_DISPENSER_MNEMONIC")
    if not m:
        pytest.skip("ALGOD_DISPENSER_MNEMONIC is required")
    sk = mnemonic.to_private_key(m)
    addr = account.address_from_private_key(sk)
    return sk, addr

def _funded(algod_client: algod_v2.AlgodClient, dispens: Tuple[str, str]) -> Tuple[str, str]:
    sk, addr = create_account()
    fund(algod_client, dispens[0], addr, 5_000_000)
    return sk, addr

@pytest.fixture
def admin(algod, dispenser): return _funded(algod, dispenser)
@pytest.fixture
def sA(algod, dispenser):    return _funded(algod, dispenser)
@pytest.fixture
def sB(algod, dispenser):    return _funded(algod, dispenser)
@pytest.fixture
def sC(algod, dispenser):    return _funded(algod, dispenser)
@pytest.fixture
def payA(algod, dispenser):  return _funded(algod, dispenser)
@pytest.fixture
def expA(algod, dispenser):  return _funded(algod, dispenser)

@pytest.fixture
def app_id(algod, admin, dispenser):
    app = deploy_registry_app(algod, admin[0])
    # fund app escrow so reward inner tx can succeed
    fund(algod, dispenser[0], app_address(app), 5_000_000)
    # bump reward so net payout remains positive even after box fees
    call_abi(algod, admin[0], app, "admin_set_reward", [6_000])
    return app

# -----------------------
# Tests
# -----------------------
@pytest.mark.localnet
def test_deploy_defaults_sets_globals(algod, app_id):
    gs = read_global_state(algod, app_id)
    assert gs["is_open"] == 1
    assert gs["cap_total"] == 2
    assert gs["registered_count"] == 0
    assert gs["micro_reward"] >= 1000

@pytest.mark.localnet
def test_register_first_time_pays_reward(algod, app_id, sA):
    sk, addr = sA
    ab = addr_bytes(addr)
    boxes = [(app_id, b_profile(ab)), (app_id, b_payment_cipher(ab))]
    with balance_delta(algod, addr) as delta:
        call_abi(algod, sk, app_id, "register_intent", [b"", b"", b"X"], boxes=boxes)
    assert delta() >= 800
    assert box_exists(algod, app_id, b_profile(ab))
    assert box_get(algod, app_id, b_payment_cipher(ab)) == b"X"
    gs = read_global_state(algod, app_id)
    assert gs["registered_count"] == 1

@pytest.mark.localnet
def test_register_duplicate_rejected(algod, app_id, sA):
    sk, addr = sA
    ab = addr_bytes(addr)
    boxes = [(app_id, b_profile(ab)), (app_id, b_payment_cipher(ab))]
    call_abi(algod, sk, app_id, "register_intent", [b"", b"", b""], boxes=boxes)
    with pytest.raises(AlgodHTTPError):
        call_abi(algod, sk, app_id, "register_intent", [b"", b"", b""], boxes=boxes)

@pytest.mark.localnet
def test_cap_enforced_and_auto_closes(algod, app_id, sB, sC, dispenser):
    for sk, addr in (sB, sC):
        ab = addr_bytes(addr)
        boxes = [(app_id, b_profile(ab)), (app_id, b_payment_cipher(ab))]
        call_abi(algod, sk, app_id, "register_intent", [b"", b"", b""], boxes=boxes)
    gs = read_global_state(algod, app_id)
    assert gs["registered_count"] == 2
    assert gs["is_open"] == 0
    # try a third while closed
    sk_new, addr_new = create_account()
    fund(algod, dispenser[0], addr_new, 3_000_000)
    ab_new = addr_bytes(addr_new)
    boxes = [(app_id, b_profile(ab_new)), (app_id, b_payment_cipher(ab_new))]
    with pytest.raises(AlgodHTTPError):
        call_abi(algod, sk_new, app_id, "register_intent", [b"", b"", b""], boxes=boxes)

@pytest.mark.localnet
def test_admin_add_capacity_and_reopen(algod, app_id, admin, sA, sB, sC):
    for sk, addr in (sA, sB):
        ab = addr_bytes(addr)
        boxes = [(app_id, b_profile(ab)), (app_id, b_payment_cipher(ab))]
        call_abi(algod, sk, app_id, "register_intent", [b"", b"", b""], boxes=boxes)
    call_abi(algod, admin[0], app_id, "admin_add_capacity", [3])
    call_abi(algod, admin[0], app_id, "admin_open", [])
    ab = addr_bytes(sC[1])
    boxes = [(app_id, b_profile(ab)), (app_id, b_payment_cipher(ab))]
    call_abi(algod, sC[0], app_id, "register_intent", [b"", b"", b""], boxes=boxes)
    gs = read_global_state(algod, app_id)
    assert gs["registered_count"] == 3
    assert gs["is_open"] == 1

@pytest.mark.localnet
def test_admin_close_blocks_new(algod, app_id, admin, dispenser):
    call_abi(algod, admin[0], app_id, "admin_close", [])
    sk_new, addr_new = create_account()
    fund(algod, dispenser[0], addr_new, 3_000_000)
    ab = addr_bytes(addr_new)
    boxes = [(app_id, b_profile(ab)), (app_id, b_payment_cipher(ab))]
    with pytest.raises(AlgodHTTPError):
        call_abi(algod, sk_new, app_id, "register_intent", [b"", b"", b""], boxes=boxes)

@pytest.mark.localnet
def test_insufficient_funds_blocks_reward(algod, admin, dispenser):
    # Deploy fresh app but DO NOT fund escrow
    app = deploy_registry_app(algod, admin[0])
    sk_new, addr_new = create_account()
    fund(algod, dispenser[0], addr_new, 3_000_000)
    ab = addr_bytes(addr_new)
    boxes = [(app, b_profile(ab)), (app, b_payment_cipher(ab))]
    with pytest.raises(AlgodHTTPError):
        call_abi(algod, sk_new, app, "register_intent", [b"", b"", b""], boxes=boxes)

# -----------------------
# Dual-wallet link tests
# -----------------------
@pytest.mark.localnet
def test_link_dual_wallet_group_success(algod, app_id, dispenser, payA, expA):
    pay_sk, pay_addr = payA
    exp_sk, exp_addr = expA
    fund(algod, dispenser[0], pay_addr, 3_000_000)
    fund(algod, dispenser[0], exp_addr, 3_000_000)
    sp = algod.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000

    pb = addr_bytes(pay_addr)
    eb = addr_bytes(exp_addr)
    pending_key = b_link_pending(pb)

    txn0 = tx.ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=abi_app_args("link_payment_begin", [b"ENC"]),
        boxes=[(app_id, pending_key)],
    )
    txn1 = tx.ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=abi_app_args("link_finish", [pay_addr]),
        boxes=[(app_id, b_link(eb)),
               (app_id, b_payment_cipher(eb)),
               (app_id, pending_key)],
    )
    gid = tx.calculate_group_id([txn0, txn1])
    txn0.group = gid
    txn1.group = gid

    stx0 = txn0.sign(pay_sk)
    stx1 = txn1.sign(exp_sk)
    algod.send_transactions([stx0, stx1])
    tx.wait_for_confirmation(algod, stx0.get_txid(), 4)

    assert box_get(algod, app_id, b_link(eb)) == pb
    assert box_get(algod, app_id, b_payment_cipher(eb)) == b"ENC"
    assert not box_exists(algod, app_id, pending_key)

@pytest.mark.localnet
def test_link_order_and_mismatch_fail(algod, app_id, dispenser, payA, expA):
    pay_sk, pay_addr = payA
    exp_sk, exp_addr = expA
    fund(algod, dispenser[0], pay_addr, 3_000_000)
    fund(algod, dispenser[0], exp_addr, 3_000_000)
    sp = algod.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000

    pb = addr_bytes(pay_addr)
    eb = addr_bytes(exp_addr)
    pending_key = b_link_pending(pb)

    # wrong order (finish first)
    finish_first = tx.ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=abi_app_args("link_finish", [pay_addr]),
        boxes=[(app_id, pending_key),
               (app_id, b_link(eb)),
               (app_id, b_payment_cipher(eb))],
    )
    begin_after = tx.ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=abi_app_args("link_payment_begin", [b"ENC"]),
        boxes=[(app_id, pending_key)],
    )
    gid = tx.calculate_group_id([finish_first, begin_after])
    finish_first.group = gid
    begin_after.group = gid
    with pytest.raises(AlgodHTTPError):
        algod.send_transactions([finish_first.sign(exp_sk), begin_after.sign(pay_sk)])

    # mismatch: finish points to different payment addr
    pay2_sk, pay2_addr = create_account()
    fund(algod, dispenser[0], pay2_addr, 3_000_000)

    begin_txn = tx.ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=abi_app_args("link_payment_begin", [b"ENC"]),
        boxes=[(app_id, pending_key)],
    )
    mismatch_finish = tx.ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=abi_app_args("link_finish", [pay2_addr]),
        boxes=[(app_id, pending_key),
               (app_id, b_link(eb)),
               (app_id, b_payment_cipher(eb))],
    )
    gid2 = tx.calculate_group_id([begin_txn, mismatch_finish])
    begin_txn.group = gid2
    mismatch_finish.group = gid2
    with pytest.raises(AlgodHTTPError):
        algod.send_transactions([begin_txn.sign(pay_sk), mismatch_finish.sign(exp_sk)])






