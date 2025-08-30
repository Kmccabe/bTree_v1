# contracts/trust_game_app_scaffold.py
# Trust Game scaffold with phase gating: register, commit, reveal, set_phase
from pyteal import *

# -------- Global keys --------
PHASE_KEY = Bytes("phase")        # uint: 1=registration, 2=commit, 3=reveal, 4=settle
EXPERIMENTER_KEY = Bytes("exp")   # bytes: creator addr
N_SUBJECTS_KEY = Bytes("n")       # uint
FINALIZE_DIGEST_KEY = Bytes("fd") # bytes (reserved for integrity digest)

# -------- Local keys --------
REGISTERED_KEY = Bytes("r")       # uint (bool)
PAIR_ID_KEY = Bytes("p")          # uint (placeholder)
COMMIT_KEY = Bytes("c")           # bytes (32-byte commitment)
REVEALED_KEY = Bytes("v")         # uint (bool)
PAYOFF_KEY = Bytes("pay")         # uint (placeholder)

def approval_program() -> Expr:
    is_exp = Txn.sender() == App.globalGet(EXPERIMENTER_KEY)

    on_create = Seq(
        App.globalPut(EXPERIMENTER_KEY, Txn.sender()),
        App.globalPut(PHASE_KEY, Int(1)),   # start in registration
        App.globalPut(N_SUBJECTS_KEY, Int(0)),
        Approve(),
    )

    # ---- Methods ----

    # set_phase(new_phase: uint)  [exp-only]
    new_phase = Btoi(Txn.application_args[1])
    do_set_phase = Seq(
        Assert(is_exp),
        Assert(new_phase >= Int(1)),
        Assert(new_phase <= Int(4)),
        App.globalPut(PHASE_KEY, new_phase),
        Log(Bytes("phase")),  # exporter will read app args for specific value
        Approve(),
    )

    # register (once)  [phase == 1]
    do_register = Seq(
        Assert(App.globalGet(PHASE_KEY) == Int(1)),
        Assert(App.localGet(Txn.sender(), REGISTERED_KEY) == Int(0)),
        App.localPut(Txn.sender(), REGISTERED_KEY, Int(1)),
        App.globalPut(N_SUBJECTS_KEY, App.globalGet(N_SUBJECTS_KEY) + Int(1)),
        Log(Bytes("reg")),
        Approve(),
    )

    # commit(hash32)  [phase == 2]
    commit_arg = Txn.application_args[1]
    do_commit = Seq(
        Assert(App.globalGet(PHASE_KEY) == Int(2)),
        Assert(App.localGet(Txn.sender(), REGISTERED_KEY) == Int(1)),
        Assert(Len(commit_arg) == Int(32)),
        App.localPut(Txn.sender(), COMMIT_KEY, commit_arg),
        App.localPut(Txn.sender(), REVEALED_KEY, Int(0)),
        Log(Bytes("commit")),
        Approve(),
    )

    # reveal(value, salt)  [phase == 3]
    choice_arg = Txn.application_args[1]
    salt_arg = Txn.application_args[2]
    recompute = Sha256(Concat(choice_arg, Bytes("|"), salt_arg))
    do_reveal = Seq(
        Assert(App.globalGet(PHASE_KEY) == Int(3)),
        Assert(App.localGet(Txn.sender(), REGISTERED_KEY) == Int(1)),
        Assert(Len(App.localGet(Txn.sender(), COMMIT_KEY)) == Int(32)),
        Assert(Len(choice_arg) > Int(0)),
        Assert(Len(salt_arg) > Int(0)),
        Assert(App.localGet(Txn.sender(), COMMIT_KEY) == recompute),
        App.localPut(Txn.sender(), REVEALED_KEY, Int(1)),
        Log(Bytes("reveal")),
        Approve(),
    )

    on_noop = Cond(
        [Txn.application_args[0] == Bytes("set_phase"), do_set_phase],
        [Txn.application_args[0] == Bytes("reg"), do_register],
        [Txn.application_args[0] == Bytes("commit"), do_commit],
        [Txn.application_args[0] == Bytes("reveal"), do_reveal],
    )

    program = Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        [Txn.on_completion() == OnComplete.UpdateApplication, Seq(Assert(is_exp), Approve())],
        [Txn.on_completion() == OnComplete.DeleteApplication, Seq(Assert(is_exp), Approve())],
        [Txn.on_completion() == OnComplete.NoOp, on_noop],
        [Int(1), Reject()],
    )
    return program

def clear_state_program() -> Expr:
    return Approve()

if __name__ == "__main__":
    print(compileTeal(approval_program(), mode=Mode.Application, version=8))
