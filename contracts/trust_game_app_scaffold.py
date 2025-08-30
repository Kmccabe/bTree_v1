# contracts/trust_game_app_scaffold.py
# PyTeal scaffold for bTree v1 Trust Game (placeholder logic)
from pyteal import *

# -------- Globals --------
PHASE_KEY = Bytes("phase")        # uint: 0..6
EXPERIMENTER_KEY = Bytes("exp")   # bytes
N_SUBJECTS_KEY = Bytes("n")       # uint
FINALIZE_DIGEST_KEY = Bytes("fd") # bytes (sha256 over canonical event log)

# -------- Locals --------
REGISTERED_KEY = Bytes("r")       # uint (bool)
PAIR_ID_KEY = Bytes("p")          # uint
COMMIT_KEY = Bytes("c")           # bytes
REVEALED_KEY = Bytes("v")         # uint (bool)
PAYOFF_KEY = Bytes("pay")         # uint

def approval_program() -> Expr:
    """
    Minimal scaffold:
    - Create: set experimenter=sender, phase=0, n=0
    - Update/Delete: only experimenter
    - NoOp/Clear: Approve for now (we’ll gate phases later)
    """
    on_create = Seq(
        App.globalPut(EXPERIMENTER_KEY, Txn.sender()),
        App.globalPut(PHASE_KEY, Int(0)),
        App.globalPut(N_SUBJECTS_KEY, Int(0)),
        Approve(),
    )

    is_exp = Txn.sender() == App.globalGet(EXPERIMENTER_KEY)
    on_update = Seq(Assert(is_exp), Approve())
    on_delete = Seq(Assert(is_exp), Approve())

    return Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.UpdateApplication, on_update],
        [Txn.on_completion() == OnComplete.DeleteApplication, on_delete],
        [Int(1), Approve()],
    )

def clear_state_program() -> Expr:
    return Approve()

if __name__ == "__main__":
    print(compileTeal(approval_program(), mode=Mode.Application, version=8))
