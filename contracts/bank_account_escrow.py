"""
Stateless "bank account" escrow LogicSig for funding subject registrations.

The contract allows only simple payment transactions that:
  • send at most MAX_PAYOUT microAlgos
  • do not attempt to rekey the account

Payments can be broadcast as standalone transactions; no group linkage to the
registry app is enforced here, though REGISTRY_APP_ID is defined inline for
future reference or auditing.
"""

from __future__ import annotations

from pyteal import *

MAX_PAYOUT = 200_000  # 0.2 ALGO cap per registration payout
REGISTRY_APP_ID = 747_540_520  # kept for reference / future audits


def bank_account_escrow() -> Expr:
  """
  Restrictive stateless LogicSig that only permits capped payment transfers.
  """

  return And(
    Txn.type_enum() == TxnType.Payment,
    Txn.amount() <= Int(MAX_PAYOUT),
    Txn.rekey_to() == Global.zero_address(),
  )


def compile_program() -> str:
  """
  Helper used by escrow_compile.py to produce TEAL v8 text.
  """

  return compileTeal(bank_account_escrow(), mode=Mode.Signature, version=8)


if __name__ == "__main__":
  print(compile_program())
