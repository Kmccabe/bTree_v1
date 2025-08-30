// frontend/src/deploy.ts
import * as algosdk from "algosdk";

/** Minimal placeholder contract (approves all except Update/Delete unless creator) */
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

/** Simple helper for our serverless API calls */
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`API ${path} failed: ${r.status} ${txt}`);
  }
  return r.json() as Promise<T>;
}

/** Build an unsigned app-create txn; Pera will sign it */
export async function deployPlaceholderApp(fromAddr: string): Promise<{
  txn: algosdk.Transaction;
  b64: string;
  debug: {
    suggestedParams: algosdk.SuggestedParams;
    approvalLen: number;
    clearLen: number;
    from: string;
  };
}> {
  // Normalize and validate sender address early
  const normalizedFrom = (fromAddr ?? "").toString().trim().toUpperCase();
  if (!algosdk.isValidAddress(normalizedFrom)) {
    throw new Error(`Invalid Algorand address: '${fromAddr}'`);
  }
  // 1) Suggested params (proxied via /api/params)
  const params = await api<any>("/api/params");

  // 2) Compile TEAL via serverless (Algod /v2/teal/compile)
  const approval = await api<{ result: string }>("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: APPROVAL_TEAL }),
  });
  const clear = await api<{ result: string }>("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: CLEAR_TEAL }),
  });

  const approvalProg = new Uint8Array(Buffer.from(approval.result, "base64"));
  const clearProg = new Uint8Array(Buffer.from(clear.result, "base64"));

  // 3) Normalize Algod params -> pass as any to satisfy SDK typings variance
  const minFee = Number(params["min-fee"]) || 1000;
  const firstRound = Number(params["last-round"]) || 0;
  const suggestedParams = {
    fee: minFee,
    minFee: minFee,
    flatFee: true,
    firstValid: firstRound,
    lastValid: firstRound + 1000,
    genesisHash: params["genesishashb64"],
    genesisID: params["genesis-id"],
  } as unknown as algosdk.SuggestedParams;

  // 4) Build txn using the OBJECT helper; cast the whole object to any
  const note = new TextEncoder().encode("bTree v1 placeholder app");
  // Extra guard: ensure address decodes
  const decoded = algosdk.decodeAddress(normalizedFrom);
  console.debug("deployPlaceholderApp: from", normalizedFrom, "decoded", decoded);
  console.debug("deployPlaceholderApp: suggestedParams", suggestedParams);
  console.debug("deployPlaceholderApp: approval len", approvalProg.length, "clear len", clearProg.length);
  let txn: algosdk.Transaction;
  try {
    txn = algosdk.makeApplicationCreateTxnFromObject({
      from: normalizedFrom,
      suggestedParams,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram: approvalProg,
      clearProgram: clearProg,
      numGlobalByteSlices: 0,
      numGlobalInts: 0,
      numLocalByteSlices: 0,
      numLocalInts: 0,
      note,
    } as any);
  } catch (e) {
    console.error("makeApplicationCreateTxnFromObject failed", e);
    console.error("Object passed:", {
      from: normalizedFrom,
      suggestedParams,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      approvalLen: approvalProg.length,
      clearLen: clearProg.length,
    });
    throw e;
  }

  // 5) Base64-encode for WalletConnect signing
  const b64 = Buffer.from(txn.toByte()).toString("base64");
  return {
    txn,
    b64,
    debug: {
      suggestedParams,
      approvalLen: approvalProg.length,
      clearLen: clearProg.length,
      from: normalizedFrom,
    },
  };
}
