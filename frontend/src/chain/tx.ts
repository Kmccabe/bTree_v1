// frontend/src/chain/tx.ts
//
// Client-side helpers for building unsigned Algorand transactions,
// fetching SuggestedParams from /api/params, signing with @txnlab/use-wallet,
// and submitting via /api/submit.
//
// Conventions:
// - No direct Algod calls in the browser.
// - Build unsigned txns with algosdk, sign via wallet, then POST to /api/submit.
// - Keep env secrets server-side; this module only uses fetch() to /api/*.
//
// Prefer the thin wrappers (getParams, optInApp, register, placeBid) in UI code
// to keep components concise and avoid duplicating flow details here.
//
// Usage example (inside a React component):
//   const { activeAddress, signTransactions } = useWallet();
//   const { txId } = await register({ sender: activeAddress!, appId, fakeId: "ID123", sign: signTransactions });

// cspell:ignore txns stxns appArgs NoOp
import * as algosdk from "algosdk";
import type { Transaction, SuggestedParams } from "algosdk";
import { getParamsNormalized } from "./params";
import { resolveAppId } from "../state/appId";
import { str, u64 } from "./enc";

/** Shape expected by /api/submit in this repo (single signed txn). */
type SubmitRequest = { signedTxnBase64: string };
type SubmitResponse = { txId: string };

/** Wallet signer shape from @txnlab/use-wallet v2 */
export type WalletSigner = (txns: Uint8Array[]) => Promise<Uint8Array[]>;

/** GET /api/params → SuggestedParams (normalized) */
// Back-compat alias used by other helpers in this file
export async function getSuggestedParams(): Promise<SuggestedParams> {
  return (await getParamsNormalized()) as SuggestedParams;
}

/** Normalizes server response into algosdk.SuggestedParams */
// normalizeSuggestedParams is now provided by getParamsNormalized(); keep alias for internal use
function normalizeSuggestedParams(raw: any): SuggestedParams & { minFee?: number } {
  return getParamsNormalized() as unknown as SuggestedParams & { minFee?: number };
}

// Convenience alias to match UI imports
/**
 * Fetch and normalize SuggestedParams via the serverless `/api/params` route.
 * Prefer this alias in UI code.
 */
export function getParams(): Promise<SuggestedParams> {
  return getSuggestedParams();
}

/** Build an unsigned Application Opt-In txn and return its encoded blob */
export async function buildAppOptInTxnBlob(args: {
  appId: number;
  sender: string;
  sp?: SuggestedParams; // optional: pass your own to reuse across multiple txns
}): Promise<Uint8Array> {
  const { appId, sender } = args;
  if (!sender) throw new Error("buildAppOptInTxnBlob: sender (wallet address) is required");
  const sp = args.sp ?? (await getSuggestedParams());

  const txn: Transaction = algosdk.makeApplicationOptInTxnFromObject({
    sender: sender,
    appIndex: appId,
    suggestedParams: sp,
  });

  return algosdk.encodeUnsignedTransaction(txn);
}

/** Build an unsigned Application NoOp txn and return its encoded blob */
export async function buildAppNoOpTxnBlob(args: {
  appId: number;
  sender: string;
  appArgs: Uint8Array[];
  sp?: SuggestedParams; // optional cache
}): Promise<Uint8Array> {
  const { appId, sender, appArgs } = args;
  if (!sender) throw new Error("buildAppNoOpTxnBlob: sender (wallet address) is required");
  const sp = args.sp ?? (await getSuggestedParams());

  const txn: Transaction = algosdk.makeApplicationNoOpTxnFromObject({
    sender: sender,
    appIndex: appId,
    appArgs,
    suggestedParams: sp,
  });

  return algosdk.encodeUnsignedTransaction(txn);
}

/** Sign with wallet and POST to /api/submit. Returns { txId }. */
export async function signAndSubmit(
  unsignedBlobs: Uint8Array[],
  signer: WalletSigner
): Promise<SubmitResponse> {
  if (!unsignedBlobs?.length) throw new Error("signAndSubmit: no unsigned transactions provided");
  if (!signer) throw new Error("signAndSubmit: wallet signer is required");

  // 1) Sign with the connected wallet
  const signed = await signer(unsignedBlobs);

  // 2) Convert first signed txn to base64 for transport
  const first = signed?.[0];
  if (!(first instanceof Uint8Array)) {
    throw new Error("signAndSubmit: wallet returned unexpected payload");
    }
  const signedTxnBase64 = toBase64(first);
  const body: SubmitRequest = { signedTxnBase64 };

  // 3) POST to /api/submit
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(`Submit failed: ${text}`);
  }
  return (await res.json()) as SubmitResponse;
}

// Thin wrappers for common actions
export type Signer = WalletSigner;

/**
 * Opt the `sender` into the application `appId`.
 * Delegates to: getParams → buildAppOptInTxnBlob → signAndSubmit.
 * Returns the `{ txId }` from `/api/submit`.
 */
// Small display helper
function short(addr?: string | null) {
  return typeof addr === "string" && addr.length > 12
    ? `${addr.slice(0, 6)}…${addr.slice(-6)}`
    : String(addr);
}

export async function optInApp(args: {
  sender: string;
  appId: number;
  sign: Signer;
  wait?: boolean;
}): Promise<{ txId: string; confirmedRound?: number }> {
  const TAG = "[optInApp]";
  const { sender, appId, sign, wait = true } = args;

  try { console.info("[appId] resolved =", resolveAppId()); } catch {}
  console.info(TAG, "args", { sender, appId });

  if (!sender || !algosdk.isValidAddress(sender)) {
    throw new Error(`${TAG} invalid sender: ${sender}`);
  }
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new Error(`${TAG} invalid appId: ${appId}`);
  }

  // normalized params
  const sp: any = await getParamsNormalized();
  const mf = (sp as any).minFee ?? (sp as any).fee ?? 1000;
  console.info("[tx] using params", {
    fee: sp.fee, firstRound: (sp as any).firstRound, lastRound: (sp as any).lastRound,
    genesisHash_type: (sp as any).genesisHash instanceof Uint8Array ? "Uint8Array" : typeof (sp as any).genesisHash,
    genesisHash_len: (sp as any).genesisHash instanceof Uint8Array ? (sp as any).genesisHash.length : 0,
    genesisID: (sp as any).genesisID, flatFee: (sp as any).flatFee, minFee: (sp as any).minFee,
  });

  // log everything we will pass to the SDK
  console.info(TAG, "build opt-in with", {
    from: short(sender),
    appId,
    fee: mf,
    firstRound: (sp as any).firstRound,
    lastRound: (sp as any).lastRound,
    genesisHash: (sp as any).genesisHash,
    genesisID: (sp as any).genesisID,
    flatFee: true,
  });

  let opt: any;
  try {
    opt = (algosdk as any).makeApplicationOptInTxnFromObject({
      sender: sender,
      appIndex: appId,
      suggestedParams: { ...(sp as any), flatFee: true, fee: mf },
    });
  } catch (e: any) {
    // include the exact values so we know what was undefined
    throw new Error(
      `${TAG} build failed (from=${short(sender)} appId=${appId} fee=${mf} fr=${(sp as any).firstRound} lr=${(sp as any).lastRound} gh=${(sp as any).genesisHash} gid=${(sp as any).genesisID}): ${e?.message || e}`
    );
  }

  let stxns: Uint8Array[];
  try {
    stxns = await sign([(algosdk as any).encodeUnsignedTransaction(opt)]);
    console.info(TAG, "signed 1 txn");
  } catch (e: any) {
    throw new Error(`${TAG} sign failed: ${e?.message || e}`);
  }

  const payload = { stxns: stxns.map((b) => toBase64(b)) };
  const sub = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const subText = await sub.text();
  console.info(TAG, "/api/submit", sub.status, subText);
  if (!sub.ok) throw new Error(`${TAG} submit ${sub.status}: ${subText}`);

  const sj = (() => { try { return JSON.parse(subText); } catch { return {}; } })();
  const txId = sj.txId ?? sj.txid ?? sj.txID;
  if (!txId) throw new Error(`${TAG} missing txId`);

  if (!wait) return { txId };
  const pendR = await fetch(`/api/pending?txid=${encodeURIComponent(txId)}`);
  const pendText = await pendR.text();
  console.info(TAG, "/api/pending", pendR.status, pendText);
  let pend: any; try { pend = JSON.parse(pendText); } catch { pend = {}; }
  const confirmedRound = pend?.["confirmed-round"] ?? pend?.confirmedRound;
  return { txId, confirmedRound };
}

/**
 * Register the `fakeId` on-chain via a NoOp call: ["register", fakeId].
 * Delegates to: getParams → buildAppNoOpTxnBlob → signAndSubmit.
 * Returns the `{ txId }` from `/api/submit`.
 */
export async function register(args: {
  sender: string;
  appId: number;
  fakeId: string;
  sign: Signer;
}): Promise<SubmitResponse> {
  try { console.info("[appId] resolved =", resolveAppId()); } catch {}
  const appArgs = [str("register"), str(args.fakeId)];
  const blob = await buildAppNoOpTxnBlob({ appId: args.appId, sender: args.sender, appArgs });
  return await signAndSubmit([blob], args.sign);
}

/**
 * Place a bid in microAlgos via a NoOp call: ["bid", u64(microAlgos)].
 * Validates `microAlgos` is a non-negative integer.
 * Delegates to: getParams → buildAppNoOpTxnBlob → signAndSubmit.
 * Returns the `{ txId }` from `/api/submit`.
 */
export async function placeBid(args: {
  sender: string;
  appId: number;
  microAlgos: number;
  sign: Signer;
}): Promise<SubmitResponse> {
  try { console.info("[appId] resolved =", resolveAppId()); } catch {}
  if (!Number.isInteger(args.microAlgos) || args.microAlgos < 0) {
    throw new Error("placeBid: microAlgos must be a non-negative integer");
  }
  const appArgs = [str("bid"), u64(args.microAlgos)];
  const blob = await buildAppNoOpTxnBlob({ appId: args.appId, sender: args.sender, appArgs });
  return await signAndSubmit([blob], args.sign);
}

/** Small, dependency-free base64 encoder for Uint8Array */
function toBase64(u8: Uint8Array): string {
  // Works in browsers. Avoids requiring Buffer polyfill.
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  // btoa expects binary string
  return btoa(s);
}

/**
 * Admin: set the global phase (1..4) via a NoOp call: ["set_phase", u64(phase)].
 * Only the app creator will pass the on-chain gate.
 * Returns the `{ txId }` from `/api/submit`.
 */
function shortAddr(addr?: string | null) {
  return typeof addr === "string" && addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-6)}` : String(addr);
}

export async function setPhase(args: {
  sender: string;            // creator address
  appId: number;             // numeric
  phase: number;             // 1..4
  sign: Signer;
  wait?: boolean;
}): Promise<{ txId: string; confirmedRound?: number }> {
  const TAG = "[setPhase]";
  const { sender, appId, phase, sign, wait = true } = args;

  try { console.info("[appId] resolved =", resolveAppId()); } catch {}
  console.info(TAG, "args", { sender, appId, phase });

  if (!sender || !algosdk.isValidAddress(sender)) throw new Error(`${TAG} invalid sender`);
  if (!Number.isInteger(appId) || appId <= 0) throw new Error(`${TAG} invalid appId`);
  if (!Number.isInteger(phase) || phase < 0 || phase > 3) throw new Error(`${TAG} invalid phase ${phase}`);

  const sp: any = await getParamsNormalized();
  console.info("[tx] using params", {
    fee: sp.fee, firstRound: (sp as any).firstRound, lastRound: (sp as any).lastRound,
    genesisHash_type: (sp as any).genesisHash instanceof Uint8Array ? "Uint8Array" : typeof (sp as any).genesisHash,
    genesisHash_len: (sp as any).genesisHash instanceof Uint8Array ? (sp as any).genesisHash.length : 0,
    genesisID: (sp as any).genesisID, flatFee: (sp as any).flatFee, minFee: (sp as any).minFee,
  });
  const appArgs = [str("set_phase"), u64(phase)];

  let call: any;
  try {
    const mf = (sp as any).minFee ?? sp.fee ?? 1000;
    console.info(TAG, "build AppCall", { from: shortAddr(sender), appId, fee: mf });
    call = (algosdk as any).makeApplicationNoOpTxnFromObject({
      sender: sender,
      appIndex: appId,
      appArgs,
      suggestedParams: { ...(sp as any), flatFee: true, fee: mf },
    });
  } catch (e: any) {
    console.error(TAG, "build AppCall error", e);
    throw new Error(`${TAG} build AppCall failed (from=${shortAddr(sender)} appId=${appId} phase=${phase}): ${e?.message || e}`);
  }

  let stxns: Uint8Array[];
  try {
    stxns = await sign([(algosdk as any).encodeUnsignedTransaction(call)]);
    console.info(TAG, "signed 1 txn");
  } catch (e: any) {
    console.error(TAG, "sign error", e);
    throw new Error(`${TAG} sign failed: ${e?.message || e}`);
  }

  const payload = { stxns: stxns.map((b) => toBase64(b)) };
  const sub = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const subText = await sub.text();
  console.info(TAG, "/api/submit", sub.status, subText);
  if (!sub.ok) throw new Error(`${TAG} submit ${sub.status}: ${subText}`);

  const sj = (() => { try { return JSON.parse(subText); } catch { return {}; } })();
  const txId = sj.txId ?? sj.txid ?? sj.txID;
  if (!txId) throw new Error(`${TAG} missing txId`);

  if (!wait) return { txId };
  const pendR = await fetch(`/api/pending?txid=${encodeURIComponent(txId)}`);
  const pendText = await pendR.text();
  console.info(TAG, "/api/pending", pendR.status, pendText);
  let pend: any; try { pend = JSON.parse(pendText); } catch { pend = {}; }
  const confirmedRound = pend?.["confirmed-round"] ?? pend?.confirmedRound;
  return { txId, confirmedRound };
}

/** Admin: register experiment metadata once. */
export async function registerExperiment(args: {
  sender: string;        // creator address
  appId: number;
  paramsHashB64OrHex: string; // 32 raw bytes expressed as base64 or 64-char hex
  nNeeded: number;       // uint
  contractUri: string;   // short bytes
  sign: Signer;
  wait?: boolean;
}): Promise<{ txId: string; confirmedRound?: number }>{
  const TAG = "[registerExperiment]";
  const { sender, appId, paramsHashB64OrHex, nNeeded, contractUri, sign, wait = true } = args;
  if (!sender || !algosdk.isValidAddress(sender)) throw new Error(`${TAG} invalid sender`);
  if (!Number.isInteger(appId) || appId <= 0) throw new Error(`${TAG} invalid appId`);
  if (!Number.isInteger(nNeeded) || nNeeded < 0) throw new Error(`${TAG} invalid nNeeded`);

  function decode32(raw: string): Uint8Array {
    const s = (raw || "").trim();
    // hex (64 chars, optional 0x)
    const hex = s.startsWith("0x") ? s.slice(2) : s;
    const isHex = /^[0-9a-fA-F]{64}$/.test(hex);
    if (isHex) return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    // else try base64
    try {
      const u8 = Uint8Array.from(Buffer.from(s, 'base64'));
      if (u8.length === 32) return u8;
    } catch {}
    throw new Error(`${TAG} paramsHash must be 32 bytes (hex or base64)`);
  }
  const hash32 = decode32(paramsHashB64OrHex);

  const sp: any = await getParamsNormalized();
  const mf = (sp as any).minFee ?? (sp as any).fee ?? 1000;
  const appArgs: Uint8Array[] = [
    str('registerExperiment'),
    hash32,
    u64(nNeeded),
    str(contractUri || ''),
  ];
  const call: any = (algosdk as any).makeApplicationNoOpTxnFromObject({
    sender,
    appIndex: appId,
    appArgs,
    suggestedParams: { ...(sp as any), flatFee: true, fee: mf },
  });
  const stxns = await sign([(algosdk as any).encodeUnsignedTransaction(call)]);
  const payload = { stxns: stxns.map((b) => toBase64(b)) };
  const sub = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const text = await sub.text();
  if (!sub.ok) throw new Error(`${TAG} submit ${sub.status}: ${text}`);
  let sj: any; try { sj = JSON.parse(text); } catch { sj = {}; }
  const txId: string = sj?.txId || sj?.txid || sj?.txID;
  if (!wait) return { txId };
  const pend = await (await fetch(`/api/pending?txid=${encodeURIComponent(txId)}`)).json();
  const confirmedRound: number | undefined = pend?.['confirmed-round'] ?? pend?.confirmedRound;
  return { txId, confirmedRound };
}

/**
 * investFlow: two-txn atomic group
 *   g0: Payment s from sender -> app address
 *   g1: AppCall NoOp ["invest", u64(s)] with fee bumped to cover 1 inner-pay
 * Submits the concatenated signed group via existing `/api/submit` (single body).
 */
export async function investFlow(args: {
  sender: string;
  appId: number;
  s: number; // microAlgos, non-negative integer
  sign: Signer;
  wait?: boolean;
}): Promise<{ txId: string; confirmedRound?: number }> {
  const { sender, appId, s, sign, wait = true } = args;
  const TAG = "[investFlow]";
  try { console.info("[appId] resolved =", resolveAppId()); } catch {}

  function short(addr?: string | null) {
    return typeof addr === "string" && addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-6)}` : String(addr);
  }

  // Resolve sender robustly
  const w: any = (globalThis as any) || {};
  const senderResolved =
    (typeof sender === "string" && sender) ||
    (sender as any)?.address ||
    w.activeAddress ||
    (w.wallet?.accounts?.[0]?.address ?? "");

  console.log(`${TAG} senderResolved=`, senderResolved);
  console.log(`${TAG} appId=`, appId, "s=", s);

  if (!algosdk.isValidAddress(senderResolved)) {
    throw new Error(`${TAG} invalid sender: ${JSON.stringify(senderResolved)}`);
  }
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new Error(`${TAG} invalid appId: ${appId}`);
  }
  if (!Number.isInteger(s) || s < 0) {
    throw new Error(`${TAG} invalid s (microAlgos): ${s}`);
  }

  // Derive app address
  let appAddr = "";
  try {
    appAddr = (algosdk as any).getApplicationAddress(appId)?.toString?.() || (algosdk as any).getApplicationAddress(appId);
  } catch (e: any) {
    throw new Error(`${TAG} getApplicationAddress failed for id=${appId}: ${e?.message || e}`);
  }
  console.log(`${TAG} appAddr=`, appAddr);
  if (!algosdk.isValidAddress(appAddr)) {
    throw new Error(`${TAG} derived app address invalid: ${appAddr}`);
  }

  // Decode sanity
  try {
    (algosdk as any).decodeAddress(senderResolved);
    (algosdk as any).decodeAddress(appAddr);
  } catch (e: any) {
    throw new Error(`${TAG} decodeAddress failed (from=${short(senderResolved)} to=${short(appAddr)}): ${e?.message || e}`);
  }

  // -------- PARAMS FETCH (normalized) --------
  const sp: any = await getParamsNormalized();
  console.info("[tx] using params", {
    fee: sp.fee, firstRound: (sp as any).firstRound, lastRound: (sp as any).lastRound,
    genesisHash_type: (sp as any).genesisHash instanceof Uint8Array ? "Uint8Array" : typeof (sp as any).genesisHash,
    genesisHash_len: (sp as any).genesisHash instanceof Uint8Array ? (sp as any).genesisHash.length : 0,
    genesisID: (sp as any).genesisID, flatFee: (sp as any).flatFee, minFee: (sp as any).minFee,
  });

  // Build Payment with explicit FROM/TO/AMOUNT in error
  let pay: any;
  try {
    const fromAddr = String(senderResolved ?? "").trim();
    const toAddr = String(appAddr ?? "").trim();
    console.info("[investFlow] build payment", {
      from: short(fromAddr),
      to: short(toAddr),
      from_type: typeof fromAddr,
      to_type: typeof toAddr,
      from_len: fromAddr?.length ?? -1,
      to_len: toAddr?.length ?? -1,
    });
    if (!fromAddr) throw new Error("from address empty string");
    if (!toAddr) throw new Error("to address empty string");
    if (!algosdk.isValidAddress(fromAddr)) throw new Error(`invalid from address ${fromAddr}`);
    if (!algosdk.isValidAddress(toAddr)) throw new Error(`invalid to address ${toAddr}`);

    // Try multiple builder signatures to handle SDK v2/v3 differences
    const errors: string[] = [];
    const sdkAny = algosdk as any;
    const mf = (sp as any).minFee ?? (sp as any).fee ?? 1000;
    const spFlat = { ...(sp as any), flatFee: true, fee: mf };

    // 1) Positional (legacy, widely compatible)
    if (sdkAny.makePaymentTxnWithSuggestedParams) {
      try {
        pay = sdkAny.makePaymentTxnWithSuggestedParams(fromAddr, toAddr, s, undefined, undefined, spFlat);
      } catch (e: any) {
        errors.push(`positional: ${e?.message || e}`);
      }
    }

    // 2) Object style with { from, to }
    if (!pay && sdkAny.makePaymentTxnWithSuggestedParamsFromObject) {
      try {
        pay = sdkAny.makePaymentTxnWithSuggestedParamsFromObject({
          from: fromAddr,
          to: toAddr,
          amount: s,
          suggestedParams: spFlat,
        } as any);
      } catch (e: any) {
        errors.push(`object{from,to}: ${e?.message || e}`);
      }
    }

    // 3) Object style with { from, receiver }
    if (!pay && sdkAny.makePaymentTxnWithSuggestedParamsFromObject) {
      try {
        pay = sdkAny.makePaymentTxnWithSuggestedParamsFromObject({
          from: fromAddr,
          receiver: toAddr,
          amount: s,
          suggestedParams: spFlat,
        } as any);
      } catch (e: any) {
        errors.push(`object{from,receiver}: ${e?.message || e}`);
      }
    }

    // 4) Object style with { sender, to } (some SDK variants)
    if (!pay && sdkAny.makePaymentTxnWithSuggestedParamsFromObject) {
      try {
        pay = sdkAny.makePaymentTxnWithSuggestedParamsFromObject({
          sender: fromAddr,
          to: toAddr,
          amount: s,
          suggestedParams: spFlat,
        } as any);
      } catch (e: any) {
        errors.push(`object{sender,to}: ${e?.message || e}`);
      }
    }

    // 5) Object style with { sender, receiver }
    if (!pay && sdkAny.makePaymentTxnWithSuggestedParamsFromObject) {
      try {
        pay = sdkAny.makePaymentTxnWithSuggestedParamsFromObject({
          sender: fromAddr,
          receiver: toAddr,
          amount: s,
          suggestedParams: spFlat,
        } as any);
      } catch (e: any) {
        errors.push(`object{sender,receiver}: ${e?.message || e}`);
      }
    }

    if (!pay) {
      throw new Error(`algosdk payment builder mismatch: ${errors.join(" | ")}`);
    }
  } catch (e: any) {
    throw new Error(`${TAG} build Payment failed (from=${short(senderResolved)} to=${short(appAddr)} amount=${s}): ${e?.message || e}`);
  }

  // Build AppCall
  let call: any;
  try {
    const mf = (sp as any).minFee ?? (sp as any).fee ?? 1000;
    call = (algosdk as any).makeApplicationNoOpTxnFromObject({
      sender: senderResolved,
      appIndex: appId,
      appArgs: [str("invest"), u64(s)],
      // Provide sender in foreign Accounts in case the TEAL reads it via txna Accounts
      accounts: [senderResolved],
      suggestedParams: { ...(sp as any), flatFee: true, fee: mf * 2 },
    });
  } catch (e: any) {
    throw new Error(`${TAG} build AppCall failed (from=${short(senderResolved)} appId=${appId}): ${e?.message || e}`);
  }

  (algosdk as any).assignGroupID([pay, call]);

  // Sign & submit
  const stxns = await sign([
    (algosdk as any).encodeUnsignedTransaction(pay),
    (algosdk as any).encodeUnsignedTransaction(call),
  ]);
  const payload = { stxns: stxns.map((b: Uint8Array) => toBase64(b)) };
  const sub = await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const subText = await sub.text();
  if (!sub.ok) throw new Error(`${TAG} submit HTTP ${sub.status}: ${subText}`);
  const sj = (() => { try { return JSON.parse(subText); } catch { return {}; } })();
  const txId = sj.txId ?? sj.txid ?? sj.txID;
  if (!txId) throw new Error(`${TAG} missing txId in submit response`);

  if (!wait) return { txId };
  const pend = await (await fetch(`/api/pending?txid=${encodeURIComponent(txId)}`)).json();
  const confirmedRound = pend?.["confirmed-round"] ?? pend?.confirmedRound;
  return { txId, confirmedRound };
}

/** Admin: sweep any liquid balance to creator (phase 3 only). */
export async function sweepApp(args: {
  sender: string;   // creator address
  appId: number;
  sign: Signer;
  wait?: boolean;
}): Promise<{ txId: string; confirmedRound?: number }>{
  const TAG = "[sweep]";
  const { sender, appId, sign, wait = true } = args;
  try { console.info("[appId] resolved =", resolveAppId()); } catch {}
  if (!algosdk.isValidAddress(sender)) throw new Error(`${TAG} invalid sender`);
  if (!Number.isInteger(appId) || appId <= 0) throw new Error(`${TAG} invalid appId`);

  const sp: any = await getParamsNormalized();
  const mf = (sp as any).minFee ?? (sp as any).fee ?? 1000;
  const call: any = (algosdk as any).makeApplicationNoOpTxnFromObject({
    sender,
    appIndex: appId,
    appArgs: [str("sweep")],
    // Two inner ops at most; bump fee a bit
    suggestedParams: { ...(sp as any), flatFee: true, fee: mf * 2 },
  });
  const stxns = await sign([(algosdk as any).encodeUnsignedTransaction(call)]);
  const payload = { stxns: stxns.map((b: Uint8Array) => toBase64(b)) };
  const sub = await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const text = await sub.text();
  if (!sub.ok) throw new Error(`${TAG} submit ${sub.status}: ${text}`);
  let sj: any; try { sj = JSON.parse(text); } catch { sj = {}; }
  const txId: string = sj?.txId || sj?.txid || sj?.txID;
  if (!wait) return { txId };
  const pend = await (await fetch(`/api/pending?txid=${encodeURIComponent(txId)}`)).json();
  const confirmedRound: number | undefined = pend?.['confirmed-round'] ?? pend?.confirmedRound;
  return { txId, confirmedRound };
}

/** Admin: delete the application (creator-only). */
export async function deleteApp(args: {
  sender: string;   // creator address
  appId: number;
  sign: Signer;
  wait?: boolean;
}): Promise<{ txId: string; confirmedRound?: number }>{
  const TAG = "[delete]";
  const { sender, appId, sign, wait = true } = args;
  try { console.info("[appId] resolved =", resolveAppId()); } catch {}
  if (!algosdk.isValidAddress(sender)) throw new Error(`${TAG} invalid sender`);
  if (!Number.isInteger(appId) || appId <= 0) throw new Error(`${TAG} invalid appId`);

  const sp: any = await getParamsNormalized();
  const mf = (sp as any).minFee ?? (sp as any).fee ?? 1000;
  const call: any = (algosdk as any).makeApplicationDeleteTxnFromObject({
    from: sender,
    sender,
    appIndex: appId,
    suggestedParams: { ...(sp as any), flatFee: true, fee: mf },
  } as any);
  const stxns = await sign([(algosdk as any).encodeUnsignedTransaction(call)]);
  const payload = { stxns: stxns.map((b) => toBase64(b)) } as any;
  const sub = await fetch("/api/submit", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const text = await sub.text();
  if (!sub.ok) throw new Error(`${TAG} submit ${sub.status}: ${text}`);
  let sj: any; try { sj = JSON.parse(text); } catch { sj = {}; }
  const txId: string = sj?.txId || sj?.txid || sj?.txID;
  if (!wait) return { txId };
  const pend = await (await fetch(`/api/pending?txid=${encodeURIComponent(txId)}`)).json();
  const confirmedRound: number | undefined = pend?.['confirmed-round'] ?? pend?.confirmedRound;
  return { txId, confirmedRound };
}
