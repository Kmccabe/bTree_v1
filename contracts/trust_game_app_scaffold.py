# contracts/trust_game_app_scaffold.py
# Minimal Trust Game scaffold with "register", "commit", and "reveal"
from pyteal import *

# -------- Global keys --------
PHASE_KEY = Bytes("phase")        # uint: 1 = registration open (simplified MVP)
EXPERIMENTER_KEY = Bytes("exp")   # bytes: creator addr
N_SUBJECTS_KEY = Bytes("n")       # uint
FINALIZE_DIGEST_KEY = Bytes("fd") # bytes (sha256 over canonical event log) - reserved

# -------- Local keys --------
REGISTERED_KEY = Bytes("r")       # uint (bool)
PAIR_ID_KEY = Bytes("p")          # uint (placeholder for later)
COMMIT_KEY = Bytes("c")           # bytes (32-byte commitment)
REVEALED_KEY = Bytes("v")         # uint (bool)
PAYOFF_KEY = Bytes("pay")         # uint (placeholder for later)

def approval_program() -> Expr:
    is_exp = Txn.sender() == App.globalGet(EXPERIMENTER_KEY)

    on_create = Seq(
        App.globalPut(EXPERIMENTER_KEY, Txn.sender()),
        App.globalPut(PHASE_KEY, Int(1)),   # start in registration phase
        App.globalPut(N_SUBJECTS_KEY, Int(0)),
        Approve(),
    )

    # register: only once per account
    do_register = Seq(
        Assert(App.localGet(Txn.sender(), REGISTERED_KEY) == Int(0)),
        App.localPut(Txn.sender(), REGISTERED_KEY, Int(1)),
        App.globalPut(N_SUBJECTS_KEY, App.globalGet(N_SUBJECTS_KEY) + Int(1)),
        Log(Bytes("reg")),
        Approve(),
    )

    # commit: arg1 = 32-byte commitment (sha256(choice | '|' | salt))
    commit_arg = Txn.application_args[1]
    do_commit = Seq(
        Assert(App.localGet(Txn.sender(), REGISTERED_KEY) == Int(1)),
        Assert(Len(commit_arg) == Int(32)),
        App.localPut(Txn.sender(), COMMIT_KEY, commit_arg),
        App.localPut(Txn.sender(), REVEALED_KEY, Int(0)),
        Log(Bytes("commit")),
        Approve(),
    )

    # reveal: arg1 = choice bytes; arg2 = salt bytes
    # checks sha256(choice | '|' | salt) == stored commitment
    choice_arg = Txn.application_args[1]
    salt_arg = Txn.application_args[2]
    recompute = Sha256(Concat(choice_arg, Bytes("|"), salt_arg))

    do_reveal = Seq(
        Assert(App.localGet(Txn.sender(), REGISTERED_KEY) == Int(1)),
        # must have previously committed (ensure 32-byte commit stored)
        Assert(Len(App.localGet(Txn.sender(), COMMIT_KEY)) == Int(32)),
        # basic sanity: non-empty choice and salt
        Assert(Len(choice_arg) > Int(0)),
        Assert(Len(salt_arg) > Int(0)),
        # verify commitment
        Assert(App.localGet(Txn.sender(), COMMIT_KEY) == recompute),
        App.localPut(Txn.sender(), REVEALED_KEY, Int(1)),
        Log(Bytes("reveal")),
        Approve(),
    )

    on_noop = Cond(
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
