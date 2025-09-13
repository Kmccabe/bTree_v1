import os, json
from pathlib import Path
import requests

# Find repo root robustly whether this file is under contracts/ or tests/contract/
HERE = Path(__file__).resolve()
if "contracts" in HERE.parts:
    REPO = HERE.parents[1]  # .../bTree_v1
elif "tests" in HERE.parts and "contract" in HERE.parts:
    REPO = HERE.parents[2]  # .../bTree_v1
else:
    REPO = HERE.parents[1]  # fallback

ARTIFACTS = REPO / "artifacts"

def test_artifacts_exist():
    approval = ARTIFACTS / "approval.teal"
    clear = ARTIFACTS / "clear.teal"
    manifest = ARTIFACTS / "contract.manifest.json"
    assert approval.exists(), f"Missing {approval} (run: python contracts/build.py)"
    assert clear.exists(), f"Missing {clear} (run: python contracts/build.py)"
    j = json.loads(manifest.read_text())
    assert "artifacts" in j and "approval" in j["artifacts"]

def test_algod_compile_endpoint_localnet():
    algod = os.getenv("ALGOD_LOCAL", "http://localhost:4001")
    # Default to the common LocalNet token so tests work out-of-the-box
    token = os.getenv(
        "ALGOD_LOCAL_TOKEN",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
    approval = (ARTIFACTS / "approval.teal").read_text()

    headers = {"Content-Type": "text/plain", "X-Algo-API-Token": token}

    r = requests.post(
        f"{algod}/v2/teal/compile",
        data=approval,
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200, f"compile failed: {r.status_code} {r.text}"
    assert "result" in r.json()

