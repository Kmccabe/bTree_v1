from __future__ import annotations

import base64
import os
from typing import Dict, Iterable, List, Sequence, Tuple

import algosdk
from algosdk import account, encoding, mnemonic, transaction
from algosdk.error import AlgodHTTPError
from algosdk.logic import get_application_address
from algosdk.transaction import (
    ApplicationCreateTxn,
    ApplicationNoOpTxn,
    BoxReference,
    OnComplete,
    PaymentTxn,
    StateSchema,
    calculate_group_id,
    wait_for_confirmation,
)
from algosdk.v2client import algod
from pyteal import Mode, compileTeal

from contracts.registry.registry import get_router

ALGOD_URL = os.environ.get("ALGOD_URL", "http://localhost:4001")
ALGOD_TOKEN = os.environ.get("ALGOD_TOKEN", "a" * 64)

PROFILE_PREFIX = b"profile:"  # + raw addr
PAYMENT_CIPHER_PREFIX = b"payment_cipher:"
LINK_PREFIX = b"link:"
LINK_PENDING_PREFIX = b"link_pending:"

router = get_router()
approval_expr, clear_expr, contract = router.compile_program(version=8)


def _as_teal(program) -> str:
    if hasattr(program, "teal"):
        teal = program.teal
        return teal if isinstance(teal, str) else teal.decode()
    if hasattr(program, "to_teal"):
        return program.to_teal()
    return compileTeal(program, Mode.Application, version=8)


APPROVAL_TEAL = _as_teal(approval_expr)
CLEAR_TEAL = _as_teal(clear_expr)


def get_algod() -> algod.AlgodClient:
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL)


def compile_teal(client: algod.AlgodClient, teal: str) -> bytes:
    resp = client.compile(teal)
    return base64.b64decode(resp["result"])


def create_account() -> Tuple[str, str]:
    sk, addr = account.generate_account()
    return sk, addr


def get_dispense_sk() -> str:
    faucet_mn = os.environ.get("ALGOD_DISPENSER_MNEMONIC")
    if not faucet_mn:
        raise RuntimeError("Set ALGOD_DISPENSER_MNEMONIC for dispensing funds on LocalNet")
    return mnemonic.to_private_key(faucet_mn)


def fund(client: algod.AlgodClient, src_sk: str, dest_addr: str, amt: int) -> None:
    if amt <= 0:
        return
    src_addr = account.address_from_private_key(src_sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000
    txn = PaymentTxn(src_addr, sp, dest_addr, amt)
    stxn = txn.sign(src_sk)
    txid = client.send_transaction(stxn)
    wait_for_confirmation(client, txid)


def get_balance(client: algod.AlgodClient, addr: str) -> int:
    return client.account_info(addr)["amount"]


def deploy_app(
    client: algod.AlgodClient,
    creator_sk: str,
    approval_teal: str,
    clear_teal: str,
    global_schema: StateSchema,
    local_schema: StateSchema,
    app_args: Sequence[bytes] | None = None,
    extra_pages: int = 0,
) -> int:
    approval = compile_teal(client, approval_teal)
    clear = compile_teal(client, clear_teal)
    sender = account.address_from_private_key(creator_sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000
    txn = ApplicationCreateTxn(
        sender,
        sp,
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
    result = wait_for_confirmation(client, txid)
    app_id = result["application-index"]
    print(f"→ Deployed Registry app_id={app_id}")
    return app_id


def read_global_state(client: algod.AlgodClient, app_id: int) -> Dict[str, int | bytes]:
    info = client.application_info(app_id)
    result: Dict[str, int | bytes] = {}
    for item in info["params"].get("global-state", []):
        key = base64.b64decode(item["key"]).decode()
        val = item["value"]
        if val["type"] == 1:
            result[key] = base64.b64decode(val["bytes"])
        else:
            result[key] = val["uint"]
    return result


def box_get(client: algod.AlgodClient, app_id: int, key: bytes) -> bytes | None:
    try:
        data = client.application_box_by_name(app_id, key)
        return base64.b64decode(data["value"])
    except AlgodHTTPError:
        return None


def box_exists(client: algod.AlgodClient, app_id: int, key: bytes) -> bool:
    return box_get(client, app_id, key) is not None


def encode_u64(value: int) -> bytes:
    return value.to_bytes(8, "big")


def encode_addr(addr: str) -> bytes:
    return encoding.decode_address(addr)


def pad_args(method_name: str, args: Sequence[bytes]) -> List[bytes]:
    method = next(m for m in contract.methods if m.name == method_name)
    padded = list(args)
    while len(padded) < len(method.args):
        padded.append(b"")
    return [method.get_selector(), *padded]


def call_abi(
    client: algod.AlgodClient,
    app_id: int,
    method: str,
    sender_sk: str,
    args: Sequence[bytes] | None = None,
    boxes: Iterable[Tuple[int, bytes]] | None = None,
) -> None:
    sender = account.address_from_private_key(sender_sk)
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000
    app_args = pad_args(method, list(args or []))
    unique_boxes = []
    if boxes:
        seen = set()
        for entry in boxes:
            if entry not in seen:
                unique_boxes.append(BoxReference(entry[0], entry[1]))
                seen.add(entry)
    txn = ApplicationNoOpTxn(sender, sp, app_id, app_args=app_args, boxes=unique_boxes)
    stxn = txn.sign(sender_sk)
    txid = client.send_transaction(stxn)
    wait_for_confirmation(client, txid)
    print(f"  ✓ {method} called by {sender}")


def summary_globals(client: algod.AlgodClient, app_id: int) -> None:
    gs = read_global_state(client, app_id)
    print(
        "Globals:",
        {
            "is_open": gs.get("is_open"),
            "cap_total": gs.get("cap_total"),
            "registered_count": gs.get("registered_count"),
            "micro_reward": gs.get("micro_reward"),
        },
    )


def main() -> None:
    client = get_algod()
    dispenser_sk = get_dispense_sk()
    dispenser_addr = account.address_from_private_key(dispenser_sk)
    print(f"Using dispenser {dispenser_addr}")

    admin_sk, admin_addr = create_account()
    fund(client, dispenser_sk, admin_addr, 5_000_000)
    print(f"Admin {admin_addr} funded")

    global_schema = StateSchema(num_uints=5, num_byte_slices=1)
    local_schema = StateSchema(num_uints=0, num_byte_slices=0)
    app_id = deploy_app(
        client,
        admin_sk,
        APPROVAL_TEAL,
        CLEAR_TEAL,
        global_schema,
        local_schema,
        app_args=[encode_u64(2)],
    )
    app_addr = get_application_address(app_id)
    print(f"App address: {app_addr}")
    summary_globals(client, app_id)

    print("Funding app with 2 ALGO")
    fund(client, dispenser_sk, app_addr, 2_000_000)

    def new_subject(label: str) -> Tuple[str, str]:
        sk, addr = create_account()
        fund(client, dispenser_sk, addr, 2_000_000)
        print(f"Subject {label} => {addr}")
        return sk, addr

    sA_sk, sA_addr = new_subject("sA")
    sB_sk, sB_addr = new_subject("sB")
    sC_sk, sC_addr = new_subject("sC")

    print("\n-- sA registers with payout cipher --")
    before = get_balance(client, sA_addr)
    call_abi(
        client,
        app_id,
        "register_intent",
        sA_sk,
        args=[b"", b"", b"X"],
        boxes=[
            (app_id, PROFILE_PREFIX + encode_addr(sA_addr)),
            (app_id, PAYMENT_CIPHER_PREFIX + encode_addr(sA_addr)),
        ],
    )
    after = get_balance(client, sA_addr)
    print(f"  Balance delta: {after - before} µALGO")
    print(
        "  profile exists:",
        box_exists(client, app_id, PROFILE_PREFIX + encode_addr(sA_addr)),
    )
    print(
        "  cipher:",
        box_get(client, app_id, PAYMENT_CIPHER_PREFIX + encode_addr(sA_addr)),
    )
    summary_globals(client, app_id)

    print("Attempt duplicate register (expect failure)")
    try:
        call_abi(
            client,
            app_id,
            "register_intent",
            sA_sk,
            args=[b"", b"", b""],
            boxes=[
                (app_id, PROFILE_PREFIX + encode_addr(sA_addr)),
                (app_id, PAYMENT_CIPHER_PREFIX + encode_addr(sA_addr)),
            ],
        )
    except AlgodHTTPError as err:
        print("  ✓ duplicate rejected:", err)

    print("\n-- sB registers (fills cap) --")
    call_abi(
        client,
        app_id,
        "register_intent",
        sB_sk,
        args=[b"", b"", b""],
        boxes=[
            (app_id, PROFILE_PREFIX + encode_addr(sB_addr)),
            (app_id, PAYMENT_CIPHER_PREFIX + encode_addr(sB_addr)),
        ],
    )
    summary_globals(client, app_id)
    print("Registry should now be closed")

    print("sC attempts while closed (expect failure)")
    try:
        call_abi(
            client,
            app_id,
            "register_intent",
            sC_sk,
            args=[b"", b"", b""],
            boxes=[
                (app_id, PROFILE_PREFIX + encode_addr(sC_addr)),
                (app_id, PAYMENT_CIPHER_PREFIX + encode_addr(sC_addr)),
            ],
        )
    except AlgodHTTPError as err:
        print("  ✓ closed registry rejection:", err)

    print("\n-- Admin adds capacity + reopens --")
    call_abi(client, app_id, "admin_add_capacity", admin_sk, args=[encode_u64(3)])
    call_abi(client, app_id, "admin_open", admin_sk)
    call_abi(
        client,
        app_id,
        "register_intent",
        sC_sk,
        args=[b"", b"", b""],
        boxes=[
            (app_id, PROFILE_PREFIX + encode_addr(sC_addr)),
            (app_id, PAYMENT_CIPHER_PREFIX + encode_addr(sC_addr)),
        ],
    )
    summary_globals(client, app_id)

    print("\n-- Dual-wallet link (payment ↔ experiment) --")
    def new_wallet(label: str) -> Tuple[str, str]:
        sk, addr = create_account()
        fund(client, dispenser_sk, addr, 2_000_000)
        print(f"Wallet {label} => {addr}")
        return sk, addr

    pay_sk, pay_addr = new_wallet("payA")
    exp_sk, exp_addr = new_wallet("expA")

    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 1000

    pending_key = LINK_PENDING_PREFIX + encode_addr(pay_addr)
    begin_args = pad_args("link_payment_begin", [b"ENC"])
    begin_boxes = [BoxReference(app_id, pending_key)]
    txn0 = ApplicationNoOpTxn(
        sender=pay_addr,
        sp=sp,
        index=app_id,
        app_args=begin_args,
        boxes=begin_boxes,
    )

    finish_args = pad_args("link_finish", [encode_addr(pay_addr)])
    finish_boxes = [
        BoxReference(app_id, pending_key),
        BoxReference(app_id, LINK_PREFIX + encode_addr(exp_addr)),
        BoxReference(app_id, PAYMENT_CIPHER_PREFIX + encode_addr(exp_addr)),
    ]
    txn1 = ApplicationNoOpTxn(
        sender=exp_addr,
        sp=sp,
        index=app_id,
        app_args=finish_args,
        boxes=finish_boxes,
    )

    gid = calculate_group_id([txn0, txn1])
    txn0.group = gid
    txn1.group = gid

    stx0 = txn0.sign(pay_sk)
    stx1 = txn1.sign(exp_sk)
    txid = client.send_transactions([stx0, stx1])
    wait_for_confirmation(client, txid)
    print("  ✓ link group confirmed")

    print(
        "  link box:",
        box_get(client, app_id, LINK_PREFIX + encode_addr(exp_addr)),
    )
    print(
        "  payment cipher:",
        box_get(client, app_id, PAYMENT_CIPHER_PREFIX + encode_addr(exp_addr)),
    )
    print(
        "  pending exists:",
        box_exists(client, app_id, pending_key),
    )

    print("\nFinal state:")
    summary_globals(client, app_id)
    print("App balance:", get_balance(client, app_addr), "µALGO")


if __name__ == "__main__":
    main()
