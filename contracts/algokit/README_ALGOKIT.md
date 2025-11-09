# AlgoKit Quickstart for Escrow Compile

**Prereqs:** Python 3.11+, Docker (for localnet), AlgoKit 2.2.x

```bash
pipx install "algokit==2.2.*"
algokit --version   # must show 2.2.x
algokit localnet start
algokit config set profile=localnet
algokit task compile-escrow
```

Outputs:

- `contracts/artifacts/bank_account_escrow.teal`
- `contracts/artifacts/bank_account_escrow.address.txt`
