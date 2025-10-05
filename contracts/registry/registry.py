from __future__ import annotations

from typing import Tuple

from pyteal import (
    App,
    Assert,
    Balance,
    BareCallActions,
    BoxDelete,
    BoxGet,
    BoxPut,
    Bytes,
    CallConfig,
    Concat,
    Expr,
    Global,
    Gtxn,
    If,
    Int,
    Itob,
    Len,
    MinBalance,
    Return,
    Router,
    ScratchVar,
    Seq,
    TealType,
    Txn,
    TxnField,
    TxnType,
    abi,
    InnerTxnBuilder,
)

ADMIN_ADDR_KEY = Bytes("admin_addr")
IS_OPEN_KEY = Bytes("is_open")
CAP_TOTAL_KEY = Bytes("cap_total")
REGISTERED_COUNT_KEY = Bytes("registered_count")
MICRO_REWARD_KEY = Bytes("micro_reward")

MICRO_REWARD_DEFAULT = Int(1000)

PROFILE_PREFIX = Bytes("profile:")
PAYMENT_CIPHER_PREFIX = Bytes("payment_cipher:")
LINK_PREFIX = Bytes("link:")
LINK_PENDING_PREFIX = Bytes("link_pending:")


def profile_key(addr: Expr) -> Expr:
    return Concat(PROFILE_PREFIX, addr)


def payment_cipher_key(addr: Expr) -> Expr:
    return Concat(PAYMENT_CIPHER_PREFIX, addr)


def link_key(addr: Expr) -> Expr:
    return Concat(LINK_PREFIX, addr)


def link_pending_key(addr: Expr) -> Expr:
    return Concat(LINK_PENDING_PREFIX, addr)


def assert_admin() -> Expr:
    return Assert(Txn.sender() == App.globalGet(ADMIN_ADDR_KEY), comment="admin_only")


def get_router() -> Router:
    router = Router(
        "bTreeRegistry",
        BareCallActions(
            no_op=CallConfig.CALL,
            close_out=CallConfig.NEVER,
            clear_state=CallConfig.CALL,
            delete_application=CallConfig.NEVER,
            update_application=CallConfig.NEVER,
            opt_in=CallConfig.NEVER,
        ),
    )

    @router.create
    def bootstrap(cap_total: abi.Uint64) -> Expr:
        return Seq(
            App.globalPut(ADMIN_ADDR_KEY, Txn.sender()),
            App.globalPut(IS_OPEN_KEY, Int(1)),
            App.globalPut(CAP_TOTAL_KEY, cap_total.get()),
            App.globalPut(REGISTERED_COUNT_KEY, Int(0)),
            App.globalPut(MICRO_REWARD_KEY, MICRO_REWARD_DEFAULT),
            Return(Int(1)),
        )

    @router.method("register_intent(campaign:byte[],contact_hint:byte[],payout_cipher:byte[])")
    def register_intent(
        campaign: abi.DynamicBytes,
        contact_hint: abi.DynamicBytes,
        payout_cipher: abi.DynamicBytes,
    ) -> Expr:
        del campaign, contact_hint
        new_count = ScratchVar(TealType.uint64)
        reward = ScratchVar(TealType.uint64)
        sender = Txn.sender()
        profile_k = profile_key(sender)
        profile_box = BoxGet(profile_k)

        payout_bytes = payout_cipher.get()
        app_addr = Global.current_application_address()

        return Seq(
            Assert(App.globalGet(IS_OPEN_KEY) == Int(1), comment="registry_closed"),
            Assert(
                App.globalGet(REGISTERED_COUNT_KEY) < App.globalGet(CAP_TOTAL_KEY),
                comment="capacity_reached",
            ),
            profile_box,
            Assert(profile_box.hasValue() == Int(0), comment="already_registered"),
            BoxPut(profile_k, Itob(Int(1))),
            new_count.store(App.globalGet(REGISTERED_COUNT_KEY) + Int(1)),
            App.globalPut(REGISTERED_COUNT_KEY, new_count.load()),
            If(new_count.load() == App.globalGet(CAP_TOTAL_KEY)).Then(
                App.globalPut(IS_OPEN_KEY, Int(0))
            ),
            reward.store(App.globalGet(MICRO_REWARD_KEY)),
            Assert(
                Balance(app_addr) - MinBalance(app_addr) >= reward.load(),
                comment="insufficient_reward_funds",
            ),
            InnerTxnBuilder.Begin(),
            InnerTxnBuilder.SetFields(
                {
                    TxnField.type_enum: Int(TxnType.Payment),
                    TxnField.receiver: sender,
                    TxnField.amount: reward.load(),
                    TxnField.fee: Int(0),
                }
            ),
            InnerTxnBuilder.Submit(),
            If(Len(payout_bytes) > Int(0)).Then(
                BoxPut(payment_cipher_key(sender), payout_bytes)
            ),
            Return(Int(1)),
        )

    @router.method
    def admin_open() -> Expr:
        return Seq(
            assert_admin(),
            App.globalPut(IS_OPEN_KEY, Int(1)),
            Return(Int(1)),
        )

    @router.method
    def admin_close() -> Expr:
        return Seq(
            assert_admin(),
            App.globalPut(IS_OPEN_KEY, Int(0)),
            Return(Int(1)),
        )

    @router.method
    def admin_add_capacity(delta: abi.Uint64) -> Expr:
        return Seq(
            assert_admin(),
            App.globalPut(CAP_TOTAL_KEY, App.globalGet(CAP_TOTAL_KEY) + delta.get()),
            Return(Int(1)),
        )

    @router.method
    def admin_set_reward(amount: abi.Uint64) -> Expr:
        return Seq(
            assert_admin(),
            Assert(amount.get() >= MICRO_REWARD_DEFAULT, comment="min_reward"),
            App.globalPut(MICRO_REWARD_KEY, amount.get()),
            Return(Int(1)),
        )

    @router.method("link_payment_begin(payout_cipher:byte[])")
    def link_payment_begin(payout_cipher: abi.DynamicBytes) -> Expr:
        payout_bytes = payout_cipher.get()
        pending_key = link_pending_key(Txn.sender())
        existing = BoxGet(pending_key)
        return Seq(
            Assert(Global.group_size() == Int(2), comment="group_size"),
            Assert(Global.group_index() == Int(0), comment="group_pos"),
            Assert(Len(payout_bytes) > Int(0), comment="cipher_required"),
            existing,
            If(existing.hasValue()).Then(BoxDelete(pending_key)),
            BoxPut(pending_key, payout_bytes),
            Return(Int(1)),
        )

    @router.method
    def link_finish(payment_addr: abi.Address) -> Expr:
        payment_bytes = payment_addr.get()
        pending_key = link_pending_key(payment_bytes)
        pending = BoxGet(pending_key)
        cipher = ScratchVar(TealType.bytes)
        experiment_addr = Txn.sender()
        return Seq(
            Assert(Global.group_size() == Int(2), comment="group_size"),
            Assert(Global.group_index() == Int(1), comment="group_pos"),
            Assert(
                Gtxn[0].type_enum() == Int(TxnType.ApplicationCall),
                comment="gtxn0_appcall",
            ),
            Assert(
                Gtxn[0].application_id() == Global.current_application_id(),
                comment="gtxn0_same_app",
            ),
            Assert(Gtxn[0].sender() == payment_bytes, comment="payment_sender"),
            pending,
            Assert(pending.hasValue(), comment="no_pending"),
            cipher.store(pending.value()),
            BoxPut(link_key(experiment_addr), payment_bytes),
            BoxPut(payment_cipher_key(experiment_addr), cipher.load()),
            BoxDelete(pending_key),
            Return(Int(1)),
        )

    return router


def approval_program() -> Expr:
    router = get_router()
    approval, _, _ = router.compile_program(version=8)
    return approval


def clear_state_program() -> Expr:
    router = get_router()
    _, clear, _ = router.compile_program(version=8)
    return clear
