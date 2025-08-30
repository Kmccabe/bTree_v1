import os, json
from pathlib import Path
import requests

ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts"

def test_artifacts_exist():
    assert (ARTIFACTS / "approval.teal").exists()
    assert (ARTIFACTS / "clear.teal").exists()
    j = json.loads((ARTIFACTS / "contract.manifest.json").read_text())
    assert "artifacts" in j and "approval" in j["artifacts"]

def test_algod_compile_endpoint_localnet():
    algod = os.getenv("ALGOD_LOCAL", "http://localhost:4001")
    approval = (ARTIFACTS / "approval.teal").read_text()
    r = requests.post(f"{algod}/v2/teal/compile", data=approval, headers={"Content-Type": "text/plain"})
    assert r.status_code == 200, f"compile failed: {r.status_code} {r.text}"
    assert "result" in r.json()
