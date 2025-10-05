import base64
import os
from contextlib import contextmanager
from typing import Callable, Dict, Iterable, List, Sequence, Tuple

import algosdk
import pytest
from algosdk import account, encoding, mnemonic, transaction
from algosdk.error import AlgodHTTPError
from algosdk.logic import get_application_address
from algosdk.transaction import ApplicationNoOpTxn, BoxReference, OnComplete, PaymentTxn, wait_for_confirmation
from algosdk.v2client import algod as algod_v2
from pyteal import Mode, compileTeal

from contracts.registry.registry import get_router


ALGOD_URL = os.environ.get("ALGOD_URL", "http://localhost:4001")
ALGOD_TOKEN = os.environ.get("ALGOD_TOKEN", "a" * 64)

PROFILE_PREFIX = b"profile:"
PAYMENT_CIPHER_PREFIX = b"payment_cipher:"
LINK_PREFIX = b"link:"
LINK_PENDING_PREFIX = b"link_pending:"

ROUTER = get_router()
APPROVAL_PROG, CLEAR_PROG, CONTRACT = ROUTER.compile_program(version=8)
METHODS = {m.name: m for m in CONTRACT.methods}


def _program_to_teal(program) -> str:
    if hasattr(program, "to_teal"):
        return program.to_teal()
    if hasattr(program, "teal"):
        teal = program.teal
        return teal if isinstance(teal, str) else teal.decode()
    return compileTeal(program, Mode.Application, version=8)


APPROVAL_TEAL = _program_to_teal(APPROVAL_PROG)
CLEAR_TEAL = _program_to_teal(CLEAR_PROG)


def get_algod() -> algod_v2.AlgodClient:
    return algod_v2.AlgodClient(ALGOD_TOKEN, ALGOD_URL)


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
    txn = PaymentTxn(src_addr, sp, dest_addr, amount)
    stxn = txn.sign(src_sk)
    txid = client.send_transaction(stxn)
    wait_for_confirmation(client, txid, 4)


def get_balance(client: algod_v2.AlgodClient, addr: str) -> int:
    return client.account_info(addr)["amount"]


def compile_teal(client: algod_v2.AlgodClient, teal_source: str) -> bytes:
    response = client.compile(teal_source)
    return base64.b64decode(response["result"])


def deploy_app(
    client: algod_v2.AlgodClient,
    creator_sk: str,
    approval_teal: str,
    clear_teal: str,
    global_schema: transaction.StateSchema,
    local_schema: transaction.StateSchema,
    extra_pages: int = 0,
    app_args: Sequence[bytes] | None = None,
) -> int:
    approval = compile_teal(client, approval_teal)
    clear = compile_teal(client, clear_teal)
    sender = account.address_from_private_key(creator_sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000
    txn = transaction.ApplicationCreateTxn(
        sender=sender,
        sp=sp,
        on_complete=OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=clear,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=list(app_args or []),
        extra_pages=extra_pages,
    )
    stxn = txn.sign(creator_sk)
    txid = client.send_transaction(stxn)
    result = wait_for_confirmation(client, txid, 4)
    return result["application-index"]


def _as_box_refs(boxes: Iterable[Tuple[int, bytes]] | None) -> List[BoxReference] | None:
    if not boxes:
        return None
    # Preserve order but dedupe identical entries
    seen: set[Tuple[int, bytes]] = set()
    refs: List[BoxReference] = []
    for app_id, key in boxes:
        entry = (app_id, key)
        if entry in seen:
            continue
        seen.add(entry)
        refs.append(BoxReference(app_id, key))
    return refs


def call_app(
    client: algod_v2.AlgodClient,
    caller_sk: str,
    app_id: int,
    method: str,
    args: Sequence[bytes] | None = None,
    boxes: Iterable[Tuple[int, bytes]] | None = None,
    fee: int | None = None,
    on_complete: OnComplete = OnComplete.NoOpOC,
) -> Dict:
    caller_addr = account.address_from_private_key(caller_sk)
    method_obj = METHODS[method]
    raw_args: List[bytes] = list(args or [])
    while len(raw_args) < len(method_obj.args):
        raw_args.append(b"")
    app_args = [method_obj.get_selector(), *raw_args]
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = fee if fee is not None else 1000
    txn = transaction.ApplicationCallTxn(
        sender=caller_addr,
        sp=sp,
        index=app_id,
        on_complete=on_complete,
        app_args=app_args,
        boxes=_as_box_refs(boxes),
    )
    stxn = txn.sign(caller_sk)
    txid = client.send_transaction(stxn)
    return wait_for_confirmation(client, txid, 4)


def read_global_state(client: algod_v2.AlgodClient, app_id: int) -> Dict[str, int | bytes]:
    info = client.application_info(app_id)
    state_array = info["params"].get("global-state", [])
    result: Dict[str, int | bytes] = {}
    for item in state_array:
        key = base64.b64decode(item["key"]).decode()
        if item["value"]["type"] == 1:
            result[key] = base64.b64decode(item["value"]["bytes"])
        else:
            result[key] = item["value"]["uint"]
    return result


def box_get(client: algod_v2.AlgodClient, app_id: int, key: bytes) -> bytes | None:
    try:
        data = client.application_box_by_name(app_id, key)
        return base64.b64decode(data["value"])
    except AlgodHTTPError:
        return None


def box_exists(client: algod_v2.AlgodClient, app_id: int, key: bytes) -> bool:
    return box_get(client, app_id, key) is not None


@contextmanager
def balance_delta(client: algod_v2.AlgodClient, addr: str) -> Callable[[], int]:
    before = get_balance(client, addr)
    yield lambda: get_balance(client, addr) - before


def encode_u64(value: int) -> bytes:
    return value.to_bytes(8, "big")


def encode_addr(addr: str) -> bytes:
    return encoding.decode_address(addr)


@pytest.fixture(scope="session")
def algod():
    return get_algod()


@pytest.fixture(scope="session")
def dispenser():
    faucet_mnemonic = os.environ.get("ALGOD_DISPENSER_MNEMONIC")
    if not faucet_mnemonic:
        pytest.skip("ALGOD_DISPENSER_MNEMONIC environment variable required for LocalNet tests")
    sk = mnemonic.to_private_key(faucet_mnemonic)
    addr = account.address_from_private_key(sk)
    return sk, addr


def _funded_account(algod_client: algod_v2.AlgodClient, dispenser_account: Tuple[str, str]) -> Tuple[str, str]:
    sk, addr = create_account()
    fund(algod_client, dispenser_account[0], addr, 5_000_000)
    return sk, addr


@pytest.fixture
def admin(algod, dispenser):
    return _funded_account(algod, dispenser)


@pytest.fixture
def sA(algod, dispenser):
    return _funded_account(algod, dispenser)


@pytest.fixture
def sB(algod, dispenser):
    return _funded_account(algod, dispenser)


@pytest.fixture
def sC(algod, dispenser):
    return _funded_account(algod, dispenser)


@pytest.fixture
def payA(algod, dispenser):
    return _funded_account(algod, dispenser)


@pytest.fixture
def expA(algod, dispenser):
    return _funded_account(algod, dispenser)


def deploy_registry_app(client: algod_v2.AlgodClient, admin_sk: str, cap_total: int = 2) -> int:
    global_schema = transaction.StateSchema(4, 1)
    local_schema = transaction.StateSchema(0, 0)
    return deploy_app(
        client,
        admin_sk,
        APPROVAL_TEAL,
        CLEAR_TEAL,
        global_schema,
        local_schema,
        extra_pages=0,
        app_args=[encode_u64(cap_total)],
    )


@pytest.fixture
def app_id(algod, admin, dispenser):
    app_id = deploy_registry_app(algod, admin[0], cap_total=2)
    app_addr = get_application_address(app_id)
    fund(algod, dispenser[0], app_addr, 5_000_000)
    return app_id


def profile_box_key(addr: str) -> bytes:
    return PROFILE_PREFIX + encode_addr(addr)


def payment_cipher_box_key(addr: str) -> bytes:
    return PAYMENT_CIPHER_PREFIX + encode_addr(addr)


def link_box_key(addr: str) -> bytes:
    return LINK_PREFIX + encode_addr(addr)


def link_pending_box_key(addr: str) -> bytes:
    return LINK_PENDING_PREFIX + encode_addr(addr)


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
    prof_key = profile_box_key(addr)
    cipher_key = payment_cipher_box_key(addr)
    with balance_delta(algod, addr) as delta:
        call_app(
            algod,
            sk,
            app_id,
            "register_intent",
            args=[b"", b"", b"X"],
            boxes=[(app_id, prof_key), (app_id, cipher_key)],
        )
    assert delta() >= 800
    assert box_exists(algod, app_id, prof_key)
    assert box_get(algod, app_id, cipher_key) == b"X"
    gs = read_global_state(algod, app_id)
    assert gs["registered_count"] == 1


@pytest.mark.localnet
def test_register_duplicate_rejected(algod, app_id, sA):
    sk, addr = sA
    prof_key = profile_box_key(addr)
    cipher_key = payment_cipher_box_key(addr)
    call_app(
        algod,
        sk,
        app_id,
        "register_intent",
        args=[b"", b"", b""],
        boxes=[(app_id, prof_key), (app_id, cipher_key)],
    )
    with pytest.raises(AlgodHTTPError):
        call_app(
            algod,
            sk,
            app_id,
            "register_intent",
            args=[b"", b"", b""],
            boxes=[(app_id, prof_key), (app_id, cipher_key)],
        )


@pytest.mark.localnet
def test_cap_enforced_and_auto_closes(algod, app_id, sB, sC, dispenser):
    for sk, addr in (sB, sC):
        prof_key = profile_box_key(addr)
        cipher_key = payment_cipher_box_key(addr)
        call_app(
            algod,
            sk,
            app_id,
            "register_intent",
            args=[b"", b"", b""],
            boxes=[(app_id, prof_key), (app_id, cipher_key)],
        )
    gs = read_global_state(algod, app_id)
    assert gs["registered_count"] == 2
    assert gs["is_open"] == 0
    sk_new, addr_new = create_account()
    fund(algod, dispenser[0], addr_new, 3_000_000)
    prof_key = profile_box_key(addr_new)
    cipher_key = payment_cipher_box_key(addr_new)
    with pytest.raises(AlgodHTTPError):
        call_app(
            algod,
            sk_new,
            app_id,
            "register_intent",
            args=[b"", b"", b""],
            boxes=[(app_id, prof_key), (app_id, cipher_key)],
        )


@pytest.mark.localnet
def test_admin_add_capacity_and_reopen(algod, app_id, admin, sA, sB, sC):
    for sk, addr in (sA, sB):
        prof_key = profile_box_key(addr)
        cipher_key = payment_cipher_box_key(addr)
        call_app(
            algod,
            sk,
            app_id,
            "register_intent",
            args=[b"", b"", b""],
            boxes=[(app_id, prof_key), (app_id, cipher_key)],
        )
    call_app(
        algod,
        admin[0],
        app_id,
        "admin_add_capacity",
        args=[encode_u64(3)],
    )
    call_app(algod, admin[0], app_id, "admin_open")
    prof_key = profile_box_key(sC[1])
    cipher_key = payment_cipher_box_key(sC[1])
    call_app(
        algod,
        sC[0],
        app_id,
        "register_intent",
        args=[b"", b"", b""],
        boxes=[(app_id, prof_key), (app_id, cipher_key)],
    )
    gs = read_global_state(algod, app_id)
    assert gs["registered_count"] == 3
    assert gs["is_open"] == 1


@pytest.mark.localnet
def test_admin_close_blocks_new(algod, app_id, admin, dispenser):
    call_app(algod, admin[0], app_id, "admin_close")
    sk_new, addr_new = create_account()
    fund(algod, dispenser[0], addr_new, 3_000_000)
    prof_key = profile_box_key(addr_new)
    cipher_key = payment_cipher_box_key(addr_new)
    with pytest.raises(AlgodHTTPError):
        call_app(
            algod,
            sk_new,
            app_id,
            "register_intent",
            args=[b"", b"", b""],
            boxes=[(app_id, prof_key), (app_id, cipher_key)],
        )


@pytest.mark.localnet
def test_insufficient_funds_blocks_reward(algod, admin, dispenser):
    app_id = deploy_registry_app(algod, admin[0], cap_total=2)
    sk_new, addr_new = create_account()
    fund(algod, dispenser[0], addr_new, 3_000_000)
    prof_key = profile_box_key(addr_new)
    cipher_key = payment_cipher_box_key(addr_new)
    with pytest.raises(AlgodHTTPError):
        call_app(
            algod,
            sk_new,
            app_id,
            "register_intent",
            args=[b"", b"", b""],
            boxes=[(app_id, prof_key), (app_id, cipher_key)],
        )


@pytest.mark.localnet
def test_link_dual_wallet_group_success(algod, app_id, dispenser, payA, expA):
    pay_sk, pay_addr = payA
    exp_sk, exp_addr = expA
    fund(algod, dispenser[0], pay_addr, 3_000_000)
    fund(algod, dispenser[0], exp_addr, 3_000_000)
    sp = algod.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000
    pending_key = link_pending_box_key(pay_addr)
    begin_args = [METHODS["link_payment_begin"].get_selector(), b"ENC"]
    begin_boxes = _as_box_refs([(app_id, pending_key)])
    txn0 = ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=begin_args,
        boxes=begin_boxes,
    )
    finish_args = [METHODS["link_finish"].get_selector(), encode_addr(pay_addr)]
    finish_boxes = _as_box_refs(
        [
            (app_id, pending_key),
            (app_id, link_box_key(exp_addr)),
            (app_id, payment_cipher_box_key(exp_addr)),
        ]
    )
    txn1 = ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=finish_args,
        boxes=finish_boxes,
    )
    gid = transaction.calculate_group_id([txn0, txn1])
    txn0.group = gid
    txn1.group = gid
    stx0 = txn0.sign(pay_sk)
    stx1 = txn1.sign(exp_sk)
    txid = algod.send_transactions([stx0, stx1])
    wait_for_confirmation(algod, txid, 4)
    assert box_get(algod, app_id, link_box_key(exp_addr)) == encode_addr(pay_addr)
    assert box_get(algod, app_id, payment_cipher_box_key(exp_addr)) == b"ENC"
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
    pending_key = link_pending_box_key(pay_addr)

    # Wrong order: finish first
    finish_args = [METHODS["link_finish"].get_selector(), encode_addr(pay_addr)]
    finish_boxes = _as_box_refs(
        [
            (app_id, pending_key),
            (app_id, link_box_key(exp_addr)),
            (app_id, payment_cipher_box_key(exp_addr)),
        ]
    )
    txn0 = ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=finish_args,
        boxes=finish_boxes,
    )
    begin_args = [METHODS["link_payment_begin"].get_selector(), b"ENC"]
    begin_boxes = _as_box_refs([(app_id, pending_key)])
    txn1 = ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=begin_args,
        boxes=begin_boxes,
    )
    gid = transaction.calculate_group_id([txn0, txn1])
    txn0.group = gid
    txn1.group = gid
    with pytest.raises(AlgodHTTPError):
        algod.send_transactions([txn0.sign(exp_sk), txn1.sign(pay_sk)])

    # Mismatch payment address on finish
    pay2_sk, pay2_addr = create_account()
    fund(algod, dispenser[0], pay2_addr, 3_000_000)
    txn_begin = ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=begin_args,
        boxes=begin_boxes,
    )
    mismatched_args = [METHODS["link_finish"].get_selector(), encode_addr(pay2_addr)]
    mismatched_boxes = _as_box_refs(
        [
            (app_id, link_pending_box_key(pay_addr)),
            (app_id, link_box_key(exp_addr)),
            (app_id, payment_cipher_box_key(exp_addr)),
        ]
    )
    txn_finish = ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=mismatched_args,
        boxes=mismatched_boxes,
    )
    gid2 = transaction.calculate_group_id([txn_begin, txn_finish])
    txn_begin.group = gid2
    txn_finish.group = gid2
    with pytest.raises(AlgodHTTPError):
        algod.send_transactions([txn_begin.sign(pay_sk), txn_finish.sign(exp_sk)])
