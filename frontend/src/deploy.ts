// frontend/src/deploy.ts
import * as algosdk from "algosdk";
import { u64 } from "./chain/enc";

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
  const from = (fromAddr ?? "").toString().trim();
  if (!algosdk.isValidAddress(from)) {
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
  const genesisHashB64 = (params["genesis-hash"] || params["genesishashb64"] || params["genesisHash"]) as string | Uint8Array | undefined;
  const suggestedParams = {
    fee: minFee,
    minFee: minFee,
    flatFee: true,
    firstValid: firstRound,
    lastValid: firstRound + 1000,
    // include round aliases for broader SDK compatibility
    firstRound,
    lastRound: firstRound + 1000,
    genesisHash: typeof genesisHashB64 === "string" ? algosdk.base64ToBytes(genesisHashB64) : (genesisHashB64 as Uint8Array | undefined),
    genesisID: params["genesis-id"],
  } as unknown as algosdk.SuggestedParams;

  // 4) Build txn using the OBJECT helper; cast the whole object to any
  const note = new TextEncoder().encode("bTree v1 placeholder app");
  // Extra guard: ensure address decodes
  const decoded = algosdk.decodeAddress(from);
  console.debug("deployPlaceholderApp: from", from, "decoded", decoded);
  console.debug("deployPlaceholderApp: suggestedParams", suggestedParams);
  console.debug("deployPlaceholderApp: approval len", approvalProg.length, "clear len", clearProg.length);
  let txn: algosdk.Transaction;
  try {
    txn = algosdk.makeApplicationCreateTxnFromObject({
      sender: from,
      suggestedParams,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram: approvalProg,
      clearProgram: clearProg,
      numGlobalByteSlices: 0,
      numGlobalInts: 0,
      numLocalByteSlices: 0,
      numLocalInts: 0,
      note,
      appArgs: [],
      accounts: [],
      foreignApps: [],
      foreignAssets: [],
    } as any);
  } catch (e) {
    console.error("makeApplicationCreateTxnFromObject failed", e);
    console.error("Object passed:", {
      sender: from,
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
      from,
    },
  };
}

/** Deploy Trust Game app with globals E, m, UNIT set at create; returns txId, appId, and app address */
export async function deployTrustGame(args: {
  sender: string;
  E: number;
  m: number;
  UNIT: number;
  sign: (txns: Uint8Array[]) => Promise<Uint8Array[]>;
}): Promise<{ txId: string; appId: number; appAddress: string }> {
  const from = (args.sender ?? "").toString().trim();
  if (!algosdk.isValidAddress(from)) throw new Error("Invalid sender address");
  const E = Number(args.E);
  const m = Number(args.m);
  const UNIT = Number(args.UNIT);
  if (!Number.isInteger(E) || E < 0) throw new Error("E must be a non-negative integer (µAlgos)");
  if (!Number.isInteger(m) || m < 1) throw new Error("m must be an integer >= 1");
  if (!Number.isInteger(UNIT) || UNIT < 1) throw new Error("UNIT must be an integer >= 1");

  // Params and compile TEAL (using current in-file sources)
  const params = await api<any>("/api/params");
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

  const minFee = Number(params["min-fee"]) || 1000;
  const firstRound = Number(params["last-round"]) || 0;
  const genesisHashB64 = (params["genesis-hash"] || params["genesishashb64"] || params["genesisHash"]) as string | Uint8Array | undefined;
  const suggestedParams = {
    fee: minFee,
    minFee: minFee,
    flatFee: true,
    firstValid: firstRound,
    lastValid: firstRound + 1000,
    firstRound,
    lastRound: firstRound + 1000,
    genesisHash: typeof genesisHashB64 === "string" ? algosdk.base64ToBytes(genesisHashB64) : (genesisHashB64 as Uint8Array | undefined),
    genesisID: params["genesis-id"],
  } as unknown as algosdk.SuggestedParams;

  const appArgs = [u64(E), u64(m), u64(UNIT)];
  const note = new TextEncoder().encode("bTree v1 trust game");
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    sender: from,
    suggestedParams,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approvalProg,
    clearProgram: clearProg,
    numGlobalByteSlices: 0,
    numGlobalInts: 4, // E, m, UNIT, phase
    numLocalByteSlices: 0,
    numLocalInts: 0,
    appArgs,
    note,
  } as any);

  const signed = await args.sign([txn.toByte()]);
  const first = signed?.[0];
  if (!(first instanceof Uint8Array)) throw new Error("Wallet returned unexpected signature payload");
  const signedTxnBase64 = Buffer.from(first).toString("base64");

  const resp = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTxnBase64 }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || JSON.stringify(data));
  const txId = data.txId || data.txid;

  // Poll pending for application-index
  let appId: number | null = null;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const p = await fetch("/api/pending?txid=" + txId).then(r => r.json());
    const app = p["application-index"];
    if (app) { appId = Number(app); break; }
  }
  if (!appId) throw new Error("Deploy submitted but appId not found in pending within timeout");
  const appAddress = algosdk.getApplicationAddress(appId).toString();
  return { txId, appId, appAddress };
}
