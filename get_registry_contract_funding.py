from algosdk.v2client import algod
from algosdk import logic
APP_ID = 747540520
client = algod.AlgodClient("", "https://testnet-api.algonode.cloud")
app_addr = logic.get_application_address(APP_ID)
info = client.account_info(app_addr)
print("App address:", app_addr)
print("Balance (microAlgos):", info["amount"])
print("Min balance (microAlgos):", info["min-balance"])
print("Available for spending:", info["amount"] - info["min-balance"])