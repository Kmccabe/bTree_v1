# expects algosdk
from algosdk import account, mnemonic
sk, addr = account.generate_account()
print("ADMIN ADDRESS:", addr)
print("\nADMIN 25-WORD PASSPHRASE (TESTNET ONLY):\n" + mnemonic.from_private_key(sk))