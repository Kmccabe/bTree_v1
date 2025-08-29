
import algosdk from "algosdk";

export const APPROVAL_TEAL = `#pragma version 8
txn OnCompletion
int DeleteApplication
==
bnz delete_check
txn OnCompletion
int UpdateApplication
==
bnz update_check
int 1
return

delete_check:
global CreatorAddress
txn Sender
==
return

update_check:
global CreatorAddress
txn Sender
==
return
`;

export const CLEAR_TEAL = `#pragma version 8
int 1
return
`;

async function api(path: string, init?: RequestInit) {
  const r = await fetch(path, init);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deployPlaceholderApp(from: string) {
  // 1) Get suggested params from serverless proxy
  const params = await api("/api/params");

  // 2) Compile TEAL via serverless (algod compile)
  const approval = await api("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: APPROVAL_TEAL }),
  });
  const clear = await api("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: CLEAR_TEAL }),
  });

  const approvalProg = new Uint8Array(Buffer.from(approval.result, "base64"));
  const clearProg = new Uint8Array(Buffer.from(clear.result, "base64"));

  // 3) Build ApplicationCreate transaction
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from,
    suggestedParams: {
      fee: params.fee,
      flatFee: false,
      firstRound: params["last-round"],
      lastRound: params["last-round"] + 1000,
      genesisHash: params["genesishashb64"],
      genesisID: params["genesis-id"],
    },
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approvalProg,
    clearProgram: clearProg,
    numGlobalByteSlices: 0,
    numGlobalInts: 0,
    numLocalByteSlices: 0,
    numLocalInts: 0,
    note: new TextEncoder().encode("bTree v1 placeholder app"),
  });

  const b64 = Buffer.from(txn.toByte()).toString("base64");
  return { txn, b64 };
}
