import base64
import json
import os
import pathlib
from contextlib import contextmanager
from typing import Callable, Dict, Iterable, Sequence, Tuple

import pytest
from algosdk import account, encoding as enc, logic, mnemonic
from algosdk.abi import ABIType, Contract, Method
from algosdk.error import AlgodHTTPError
from algosdk import transaction as tx

from algosdk.v2client import algod as algod_v2
from pyteal import Mode, compileTeal

from contracts.registry.registry import get_router


ALGOD_URL = os.environ.get("ALGOD_URL", "http://localhost:4001")
ALGOD_TOKEN = os.environ.get("ALGOD_TOKEN", "a" * 64)

ROUTER = get_router()
APPROVAL_PROG, CLEAR_PROG, _ = ROUTER.compile_program(version=8)

CONTRACT_PATH = pathlib.Path(__file__).resolve().parents[1] / "contracts" / "artifacts" / "registry.json"
CONTRACT = Contract.from_json(CONTRACT_PATH.read_text())



def m(name: str) -> Method:
    return CONTRACT.get_method_by_name(name)


def sel(sig: str) -> bytes:
    return Method.from_signature(sig).get_selector()


def enc_u64(n: int) -> bytes:
    return ABIType.from_string("uint64").encode(n)


def enc_addr(addr: str) -> bytes:
    return ABIType.from_string("address").encode(addr)


def enc_bytes(data: bytes) -> bytes:
    return ABIType.from_string("byte[]").encode(data)


def _program_to_teal(program) -> str:
    if isinstance(program, str):
        return program
    if hasattr(program, "to_teal"):
        return program.to_teal()
    if hasattr(program, "teal"):
        teal = program.teal
        return teal if isinstance(teal, str) else teal.decode()
    return compileTeal(program, Mode.Application, version=8)


APPROVAL_TEAL = _program_to_teal(APPROVAL_PROG)
CLEAR_TEAL = _program_to_teal(CLEAR_PROG)


def addr_bytes(addr: str) -> bytes:
    return enc.decode_address(addr)


def b_profile(addr_b: bytes) -> bytes:
    return b'profile:' + addr_b


def b_payment_cipher(addr_b: bytes) -> bytes:
    return b'payment_cipher:' + addr_b


def b_link(addr_b: bytes) -> bytes:
    return b'link:' + addr_b


def b_link_pending(addr_b: bytes) -> bytes:
    return b'link_pending:' + addr_b


def app_address(app_id: int) -> str:
    return logic.get_application_address(app_id)



def call_abi(
    client: algod_v2.AlgodClient,
    sk: str,
    app_id: int,
    method_name: str,
    args: Sequence,
    boxes: Iterable[Tuple[int, bytes]] | None = None,
    fee: int | None = None,
) -> str:
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = fee if fee is not None else 1000
    sender = account.address_from_private_key(sk)
    method = m(method_name)
    app_args = [method.get_selector()]
    for arg_type, value in zip(method.arg_types, args):
        app_args.append(ABIType.from_string(arg_type).encode(value))
    txn = tx.ApplicationNoOpTxn(
        sender=sender,
        sp=sp,
        index=app_id,
        app_args=app_args,
        boxes=list(boxes or []),
    )
    signed = txn.sign(sk)
    txid = client.send_transaction(signed)
    tx.wait_for_confirmation(client, txid, 4)
    return txid


def bootstrap_registry(client: algod_v2.AlgodClient, app_id: int, admin_sk: str, cap: int = 2) -> str:
    return call_abi(client, admin_sk, app_id, "bootstrap", [cap])


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
    txn = tx.PaymentTxn(src_addr, sp, dest_addr, amount)
    stxn = txn.sign(src_sk)
    txid = client.send_transaction(stxn)
    tx.wait_for_confirmation(client, txid, 4)


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
    global_schema: tx.StateSchema,
    local_schema: tx.StateSchema,
    extra_pages: int = 0,
    app_args: Sequence[bytes] | None = None,
) -> int:
    approval = compile_teal(client, approval_teal)
    clear = compile_teal(client, clear_teal)
    sender = account.address_from_private_key(creator_sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000
    txn = tx.ApplicationCreateTxn(
        sender=sender,
        sp=sp,
        on_complete=tx.OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=clear,
        global_schema=global_schema,
        local_schema=local_schema,
        app_args=list(app_args or []),
        extra_pages=extra_pages,
    )
    stxn = txn.sign(creator_sk)
    txid = client.send_transaction(stxn)
    result = tx.wait_for_confirmation(client, txid, 4)
    return result["application-index"]




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


def deploy_registry_app(client: algod_v2.AlgodClient, admin_sk: str) -> int:
    global_schema = tx.StateSchema(4, 1)
    local_schema = tx.StateSchema(0, 0)
    return deploy_app(
        client,
        admin_sk,
        APPROVAL_TEAL,
        CLEAR_TEAL,
        global_schema,
        local_schema,
        extra_pages=0,
    )


@pytest.fixture
def app_id(algod, admin, dispenser):
    app_id = deploy_registry_app(algod, admin[0])
    bootstrap_registry(algod, app_id, admin[0], cap=2)
    app_addr = app_address(app_id)
    fund(algod, dispenser[0], app_addr, 5_000_000)
    return app_id


def profile_box_key(addr: str) -> bytes:
    return b_profile(addr_bytes(addr))


def payment_cipher_box_key(addr: str) -> bytes:
    return b_payment_cipher(addr_bytes(addr))


def link_box_key(addr: str) -> bytes:
    return b_link(addr_bytes(addr))


def link_pending_box_key(addr: str) -> bytes:
    return b_link_pending(addr_bytes(addr))


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
        call_abi(
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
    call_abi(
        algod,
        sk,
        app_id,
        "register_intent",
        args=[b"", b"", b""],
        boxes=[(app_id, prof_key), (app_id, cipher_key)],
    )
    with pytest.raises(AlgodHTTPError):
        call_abi(
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
        call_abi(
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
        call_abi(
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
        call_abi(
            algod,
            sk,
            app_id,
            "register_intent",
            args=[b"", b"", b""],
            boxes=[(app_id, prof_key), (app_id, cipher_key)],
        )
    call_abi(
        algod,
        admin[0],
        app_id,
        "admin_add_capacity",
        args=[3],
    )
    call_abi(algod, admin[0], app_id, "admin_open", [])
    prof_key = profile_box_key(sC[1])
    cipher_key = payment_cipher_box_key(sC[1])
    call_abi(
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
    call_abi(algod, admin[0], app_id, "admin_close", [])
    sk_new, addr_new = create_account()
    fund(algod, dispenser[0], addr_new, 3_000_000)
    prof_key = profile_box_key(addr_new)
    cipher_key = payment_cipher_box_key(addr_new)
    with pytest.raises(AlgodHTTPError):
        call_abi(
            algod,
            sk_new,
            app_id,
            "register_intent",
            args=[b"", b"", b""],
            boxes=[(app_id, prof_key), (app_id, cipher_key)],
        )


@pytest.mark.localnet
def test_insufficient_funds_blocks_reward(algod, admin, dispenser):
    app_id = deploy_registry_app(algod, admin[0])
    bootstrap_registry(algod, app_id, admin[0], cap=2)
    sk_new, addr_new = create_account()
    fund(algod, dispenser[0], addr_new, 3_000_000)
    prof_key = profile_box_key(addr_new)
    cipher_key = payment_cipher_box_key(addr_new)
    with pytest.raises(AlgodHTTPError):
        call_abi(
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
    pb = addr_bytes(pay_addr)
    pending_key = link_pending_box_key(pay_addr)
    link_key = link_box_key(exp_addr)
    cipher_key = payment_cipher_box_key(exp_addr)
    txn0 = tx.ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=[sel("link_payment_begin(byte[])"), enc_bytes(b"ENC")],
        boxes=[(app_id, pending_key)],
    )
    txn1 = tx.ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=[sel("link_finish(address)"), enc_addr(pay_addr)],
        boxes=[
            (app_id, link_key),
            (app_id, cipher_key),
            (app_id, pending_key),
        ],
    )
    gid = tx.calculate_group_id([txn0, txn1])
    txn0.group = gid
    txn1.group = gid
    stx0 = txn0.sign(pay_sk)
    stx1 = txn1.sign(exp_sk)
    txid = algod.send_transactions([stx0, stx1])
    tx.wait_for_confirmation(algod, txid, 4)
    assert box_get(algod, app_id, link_key) == pb
    assert box_get(algod, app_id, cipher_key) == b"ENC"
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
    link_key = link_box_key(exp_addr)
    cipher_key = payment_cipher_box_key(exp_addr)
    finish_first = tx.ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=[sel("link_finish(address)"), enc_addr(pay_addr)],
        boxes=[
            (app_id, pending_key),
            (app_id, link_key),
            (app_id, cipher_key),
        ],
    )
    begin_after = tx.ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=[sel("link_payment_begin(byte[])"), enc_bytes(b"ENC")],
        boxes=[(app_id, pending_key)],
    )
    gid = tx.calculate_group_id([finish_first, begin_after])
    finish_first.group = gid
    begin_after.group = gid
    with pytest.raises(AlgodHTTPError):
        algod.send_transactions([finish_first.sign(exp_sk), begin_after.sign(pay_sk)])

    pay2_sk, pay2_addr = create_account()
    fund(algod, dispenser[0], pay2_addr, 3_000_000)
    begin_txn = tx.ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=[sel("link_payment_begin(byte[])"), enc_bytes(b"ENC")],
        boxes=[(app_id, pending_key)],
    )
    mismatch_finish = tx.ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=[sel("link_finish(address)"), enc_addr(pay2_addr)],
        boxes=[
            (app_id, pending_key),
            (app_id, link_key),
            (app_id, cipher_key),
        ],
    )
    gid2 = tx.calculate_group_id([begin_txn, mismatch_finish])
    begin_txn.group = gid2
    mismatch_finish.group = gid2
    with pytest.raises(AlgodHTTPError):
        algod.send_transactions([begin_txn.sign(pay_sk), mismatch_finish.sign(exp_sk)])









