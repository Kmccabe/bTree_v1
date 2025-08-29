
import requests

ALGOD = "http://localhost:4001/health"
INDEXER = "http://localhost:8980/health"

def test_algod_health():
    r = requests.get(ALGOD, timeout=10)
    assert r.status_code == 200

def test_indexer_health():
    r = requests.get(INDEXER, timeout=10)
    assert r.status_code == 200
