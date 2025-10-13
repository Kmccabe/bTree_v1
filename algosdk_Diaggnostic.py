from algosdk.abi import Method, ABIType
# If this explodes, your algosdk version is odd; otherwise it's fine.
sel = Method.from_signature("bootstrap(uint64)void").get_selector()
arg = ABIType.from_string("uint64").encode(3)
print("selector bytes:", sel.hex())
print("u64 arg bytes: ", arg.hex())