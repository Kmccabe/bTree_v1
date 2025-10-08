#!/usr/bin/env python3
import base64
import os
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterable, Sequence, Tuple

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
# Environment & constants
# -----------------------
ALGOD_URL = os.environ.get("ALGOD_URL", "http://localhost:4001")
ALGOD_TOKEN = os.environ.get("ALGOD_TOKEN", "a" * 64)
ARTIFACTS_DIR = os.path.join("contracts", "artifacts")
CONTRACT_PATH = os.path.join(ARTIFACTS_DIR, "registry.json")
APPROVAL_PATH = os.path.join(ARTIFACTS_DIR, "registry_approval.teal")
CLEAR_PATH = os.path.join(ARTIFACTS_DIR, "registry_clear.teal")

BASE_FEE_MICRO = 1000
BOX_FEE_MICRO = 2000

CONTRACT = Contract.from_json(open(CONTRACT_PATH, "r", encoding="utf-8").read())


# -----------------------
# Fee helpers
# -----------------------
def fee_for(box_count: int) -> int:
    return BASE_FEE_MICRO + BOX_FEE_MICRO * box_count


# -----------------------
# Algod helpers
# -----------------------
def get_algod() -> algod_v2.AlgodClient:
    return algod_v2.AlgodClient(ALGOD_TOKEN, ALGOD_URL)


def compile_teal(client: algod_v2.AlgodClient, teal_source: str) -> bytes:
    compiled = client.compile(teal_source)
    return base64.b64decode(compiled["result"])


# -----------------------
# Address & box helpers
# -----------------------
def addr_bytes(addr: str) -> bytes:
    return enc.decode_address(addr)


def app_address(app_id: int) -> str:
    return logic.get_application_address(app_id)


def b_profile(ab: bytes) -> bytes:
    return b"profile:" + ab


def b_payment_cipher(ab: bytes) -> bytes:
    return b"payment_cipher:" + ab


def b_link(ab: bytes) -> bytes:
    return b"link:" + ab


def b_link_pending(ab: bytes) -> bytes:
    return b"link_pending:" + ab


def boxes_for_register(app_id: int, addr: str) -> list[Tuple[int, bytes]]:
    ab = addr_bytes(addr)
    return [(app_id, b_profile(ab)), (app_id, b_payment_cipher(ab))]


# -----------------------
# ABI helpers
# -----------------------
def method_by_name(name: str) -> Method:
    return CONTRACT.get_method_by_name(name)


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


def call_abi(
    client: algod_v2.AlgodClient,
    sk: str,
    app_id: int,
    method_name: str,
    args: Sequence,
    boxes: Iterable[Tuple[int, bytes]] | None = None,
    fee: int | None = None,
) -> str:
    sender = account.address_from_private_key(sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    box_list = list(boxes or [])
    sp.fee = fee if fee is not None else fee_for(len(box_list))
    atc = AtomicTransactionComposer()
    signer = AccountTransactionSigner(sk)
    atc.add_method_call(
        app_id=app_id,
        method=method_by_name(method_name),
        sender=sender,
        sp=sp,
        signer=signer,
        method_args=list(args),
        boxes=box_list,
    )
    result = atc.execute(client, 4)
    return result.tx_ids[0]


# -----------------------
# Account & funding helpers
# -----------------------
def create_account() -> Tuple[str, str]:
    sk, addr = account.generate_account()
    return sk, addr


def fund(client: algod_v2.AlgodClient, src_sk: str, dest_addr: str, amount: int) -> str:
    if amount <= 0:
        return ""
    src_addr = account.address_from_private_key(src_sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = BASE_FEE_MICRO
    txn = tx.PaymentTxn(src_addr, sp, dest_addr, amount)
    stxn = txn.sign(src_sk)
    txid = client.send_transaction(stxn)
    tx.wait_for_confirmation(client, txid, 4)
    return txid


def get_balance(client: algod_v2.AlgodClient, addr: str) -> int:
    return client.account_info(addr)["amount"]


@contextmanager
def balance_delta(client: algod_v2.AlgodClient, addr: str):
    before = get_balance(client, addr)
    yield lambda: get_balance(client, addr) - before


# -----------------------
# Registry helpers
# -----------------------
def deploy_registry_app(client: algod_v2.AlgodClient, admin_sk: str, cap_total: int = 3) -> int:
    approval_teal = open(APPROVAL_PATH, "r", encoding="utf-8").read()
    clear_teal = open(CLEAR_PATH, "r", encoding="utf-8").read()
    approval = compile_teal(client, approval_teal)
    clear = compile_teal(client, clear_teal)
    sender = account.address_from_private_key(admin_sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = BASE_FEE_MICRO
    bootstrap = method_by_name("bootstrap")
    txn = tx.ApplicationCreateTxn(
        sender=sender,
        sp=sp,
        on_complete=tx.OnComplete.NoOpOC,
        approval_program=approval,
        clear_program=clear,
        global_schema=tx.StateSchema(4, 1),
        local_schema=tx.StateSchema(0, 0),
        app_args=[bootstrap.get_selector(), ABIType.from_string("uint64").encode(cap_total)],
    )
    stxn = txn.sign(admin_sk)
    txid = client.send_transaction(stxn)
    result = tx.wait_for_confirmation(client, txid, 4)
    return result["application-index"]


# -----------------------
# State helpers
# -----------------------
def read_global_state(client: algod_v2.AlgodClient, app_id: int) -> dict:
    info = client.application_info(app_id)
    state_array = info["params"].get("global-state", [])
    out = {}
    for item in state_array:
        key = base64.b64decode(item["key"]).decode()
        val = item["value"]
        if val["type"] == 1:
            out[key] = base64.b64decode(val["bytes"])  # bytes
        else:
            out[key] = val["uint"]
    return out


def box_get(client: algod_v2.AlgodClient, app_id: int, key: bytes) -> bytes | None:
    try:
        data = client.application_box_by_name(app_id, key)
        return base64.b64decode(data["value"])
    except AlgodHTTPError:
        return None


# -----------------------
# Step orchestration
# -----------------------
def fail_with(message: str, exit_code: int = 1):
    print(message, file=sys.stderr)
    sys.exit(exit_code)


def step(label: str):
    print(f"\n--- {label} ---")


def ensure_dispenser() -> Tuple[str, str]:
    mnemonic_env = os.environ.get("ALGOD_DISPENSER_MNEMONIC")
    if not mnemonic_env:
        fail_with("ALGOD_DISPENSER_MNEMONIC must be set in the environment", 1)
    sk = mnemonic.to_private_key(mnemonic_env)
    addr = account.address_from_private_key(sk)
    return sk, addr


def print_balances(client: algod_v2.AlgodClient, label: str, *accounts: Tuple[str, str]):
    print(label)
    for name, addr in accounts:
        print(f"  {name}: {get_balance(client, addr):,} µALGO")


def main() -> None:
    try:
        step("1. Load artifacts & connect")
        algod = get_algod()
        dispenser_sk, dispenser_addr = ensure_dispenser()
        print(f"Algod: {ALGOD_URL}")
        print(f"Dispenser: {dispenser_addr}")

        step("2. Create & fund accounts")
        admin_sk, admin_addr = create_account()
        sA_sk, sA_addr = create_account()
        sB_sk, sB_addr = create_account()
        sC_sk, sC_addr = create_account()
        pay_sk, pay_addr = create_account()
        exp_sk, exp_addr = create_account()
        for name, sk, addr in (
            ("admin", admin_sk, admin_addr),
            ("sA", sA_sk, sA_addr),
            ("sB", sB_sk, sB_addr),
            ("sC", sC_sk, sC_addr),
            ("pay", pay_sk, pay_addr),
            ("exp", exp_sk, exp_addr),
        ):
            fund(algod, dispenser_sk, addr, 3_000_000)
            print(f"Funded {name} {addr}")

        step("3. Deploy registry app")
        app_id = deploy_registry_app(algod, admin_sk, cap_total=3)
        app_addr = app_address(app_id)
        print(f"Deployed app_id={app_id}, address={app_addr}")

        step("4. Fund escrow & set reward")
        fund(algod, dispenser_sk, app_addr, 5_000_000)
        call_abi(algod, admin_sk, app_id, "admin_set_reward", [6_000])
        print("Escrow funded and reward set to 6_000 µALGO")

        step("5. Register subjects sA & sB")
        for label, sk, addr in (("sA", sA_sk, sA_addr), ("sB", sB_sk, sB_addr)):
            boxes = boxes_for_register(app_id, addr)
            with balance_delta(algod, addr) as delta:
                call_abi(algod, sk, app_id, "register_intent", [b"", b"", b"X"], boxes)
            print(f"{label} delta: {delta():,} µALGO")

        step("6. Globals after registrations")
        globals_after = read_global_state(algod, app_id)
        print(globals_after)

        step("7. Admin close & reopen with capacity add")
        call_abi(algod, admin_sk, app_id, "admin_close", [])
        print("Admin closed registry")
        try:
            call_abi(algod, sC_sk, app_id, "register_intent", [b"", b"", b""], boxes_for_register(app_id, sC_addr))
        except AlgodHTTPError as err:
            print("Closed registry blocked new registration as expected")
        else:
            fail_with("Expected registry close to block registration", 2)
        call_abi(algod, admin_sk, app_id, "admin_add_capacity", [2])
        call_abi(algod, admin_sk, app_id, "admin_open", [])
        call_abi(algod, sC_sk, app_id, "register_intent", [b"", b"", b""], boxes_for_register(app_id, sC_addr))
        print("Registry reopened, sC registered")
        print(read_global_state(algod, app_id))

        step("8. Dual-wallet link group")
        pb = addr_bytes(pay_addr)
        eb = addr_bytes(exp_addr)
        pending_key = b_link_pending(pb)
        sp0 = algod.suggested_params()
        sp0.flat_fee = True
        sp0.fee = fee_for(1)
        sp1 = algod.suggested_params()
        sp1.flat_fee = True
        sp1.fee = fee_for(3)
        txn0 = tx.ApplicationNoOpTxn(
            sender=pay_addr,
            sp=sp0,
            index=app_id,
            app_args=abi_app_args("link_payment_begin", [b"ENC"]),
            boxes=[(app_id, pending_key)],
        )
        txn1 = tx.ApplicationNoOpTxn(
            sender=exp_addr,
            sp=sp1,
            index=app_id,
            app_args=abi_app_args("link_finish", [pay_addr]),
            boxes=[
                (app_id, b_link(eb)),
                (app_id, b_payment_cipher(eb)),
                (app_id, pending_key),
            ],
        )
        gid = tx.calculate_group_id([txn0, txn1])
        txn0.group = gid
        txn1.group = gid
        stx0 = txn0.sign(pay_sk)
        stx1 = txn1.sign(exp_sk)
        algod.send_transactions([stx0, stx1])
        tx.wait_for_confirmation(algod, stx0.get_txid(), 4)
        link_value = box_get(algod, app_id, b_link(eb))
        cipher_value = box_get(algod, app_id, b_payment_cipher(eb))
        print(f"link box -> {link_value}")
        print(f"payment_cipher box -> {cipher_value}")
        print(f"pending exists? {box_get(algod, app_id, pending_key) is not None}")

        step("9. Summary")
        globals_final = read_global_state(algod, app_id)
        print("Globals:", globals_final)
        for label, addr in (("sA", sA_addr), ("sB", sB_addr), ("exp", exp_addr)):
            ab = addr_bytes(addr)
            profile = box_get(algod, app_id, b_profile(ab))
            cipher = box_get(algod, app_id, b_payment_cipher(ab))
            print(f"Boxes for {label}: profile={profile}, payment_cipher={cipher}")

        print("\nSmoke run complete.")
    except AlgodHTTPError as err:
        print(f"AlgodHTTPError: {err}", file=sys.stderr)
        sys.exit(2)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
