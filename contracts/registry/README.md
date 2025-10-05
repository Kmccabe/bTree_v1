# bTree Registry App v1

Smart-contract registry for the bTree experiment. Subjects register intent once, receive a micro reward, and optionally link a payment wallet via a two-transaction proof.

## Requirements

- Python 3.11+
- pip install -e contracts (installs pyteal>=0.24 via contracts/pyproject.toml)

## Build the TEAL + App Spec

`sh
python -m contracts.registry.compile
`

Outputs land in rtifacts/:
- egistry_approval.teal
- egistry_clear.teal
- egistry_contract.json

## Create & Fund the App

1. Deploy using the approval/clear TEAL. Pass the initial capacity (cap_total) as the single pp_arg during creation. The creator becomes dmin_addr and the registry starts is_open = 1 with micro_reward = 1000 microAlgos (0.001 ALGO).
2. Fund the application address with enough Algos to cover rewards: eward * expected_signups + buffer. The contract checks available balance before every payout.

## Registering Intent (Subjects)

Call egister_intent (NoOp) with optional bytes:
`
app call: register_intent(campaign?, contact_hint?, payout_cipher?)
`
- Fails if the registry is closed, the cap is full, or the sender already registered.
- On success stores profile:<address> and pays the sender micro_reward (default 1000 µAlgos).
- If payout_cipher is non-empty, the opaque bytes are saved at payment_cipher:<address> for later payouts.

## Admin Controls

All admin actions must be sent by dmin_addr:
- dmin_open() / dmin_close() – toggle is_open.
- dmin_add_capacity(delta) – increase cap_total.
- dmin_set_reward(amount) – change the micro reward (must be = 1000).

## Dual-Wallet Linking Flow

Proves control of a payment wallet and experiment wallet in one atomic group:

`
Gtxn[0]: payment wallet ? app call link_payment_begin(payout_cipher)
Gtxn[1]: experiment wallet ? app call link_finish(payment_addr)
`

Requirements:
- Group size must be exactly 2.
- Gtxn[0] must target this app and come from the payment wallet (payment_addr).
- link_finish copies the pending cipher into payment_cipher:<experiment_addr> and stores the payment wallet at link:<experiment_addr>.
- The pending entry link_pending:<payment_addr> is deleted after success, preventing replay.

## Security Notes

- payout_cipher is never decrypted on-chain. Encrypt it client-side (e.g., X25519/NaCl) before submission.
- Ensure the app remains prefunded; insufficient funds cause registration to fail before state changes.
- Capacity auto-closes when egistered_count == cap_total. Admin may add capacity and reopen later.
