import os, json, base64
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk.abi import Contract
from algosdk.atomic_transaction_composer import (
    AccountTransactionSigner,
    AtomicTransactionComposer,
)
ALGOD_URL="https://testnet-api.algonode.cloud"; ALGOD_TOKEN=""
app_id = 747540520
m = os.environ.get("ALGOD_DEPLOY_MNEMONIC","").strip()
sk = mnemonic.to_private_key(m); addr = account.address_from_private_key(sk)
client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL)
contract = Contract.from_json(open("contracts/artifacts/registry.json").read())
meth = contract.get_method_by_name("admin_set_reward")
sp = client.suggested_params(); sp.flat_fee=True; sp.fee=1000
atc = AtomicTransactionComposer()
atc.add_method_call(app_id, meth, addr, sp, AccountTransactionSigner(sk), [1000])
print("txids:", atc.execute(client, 4).tx_ids)

