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
// Usage example (inside a React component):
//   const { activeAddress, signTransactions } = useWallet();
//   const blob = await buildAppNoOpTxnBlob({ appId, sender: activeAddress!, appArgs: [str("ping")] });
//   const { txId } = await signAndSubmit([blob], signTransactions);

// cspell:ignore txns stxns appArgs NoOp
import * as algosdk from "algosdk";
import type { Transaction, SuggestedParams } from "algosdk";

/** Shape expected by /api/submit in this repo (single signed txn). */
type SubmitRequest = { signedTxnBase64: string };
type SubmitResponse = { txId: string };

/** Wallet signer shape from @txnlab/use-wallet v2 */
export type WalletSigner = (txns: Uint8Array[]) => Promise<Uint8Array[]>;

/** GET /api/params → SuggestedParams (normalized) */
export async function getSuggestedParams(): Promise<SuggestedParams> {
  const res = await fetch("/api/params", { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(`Failed to fetch params: ${text}`);
  }
  const p = await res.json();
  return normalizeSuggestedParams(p);
}

/** Normalizes server response into algosdk.SuggestedParams */
function normalizeSuggestedParams(p: any): SuggestedParams {
  const gh = p.genesisHash ?? p["genesis-hash"] ?? p["genesishashb64"]; // may be b64 string
  const genesisHash = typeof gh === "string" ? algosdk.base64ToBytes(gh) : gh;
  const lastRound = Number(p.lastRound ?? p["last-round"] ?? 0);
  const firstRound = Number(p.firstRound ?? p["first-round"] ?? lastRound);
  const computedLast = lastRound ? lastRound + 1000 : firstRound + 1000;
  return {
    flatFee: p.flatFee ?? p["flat-fee"] ?? true,
    fee: Number(p.fee ?? p["fee"] ?? p["min-fee"] ?? 1000),
    firstRound,
    lastRound: computedLast,
    firstValid: firstRound,
    lastValid: computedLast,
    genesisHash,
    genesisID: p.genesisID ?? p["genesis-id"],
  } as unknown as SuggestedParams;
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
    from: sender,
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
    from: sender,
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

/** Small, dependency-free base64 encoder for Uint8Array */
function toBase64(u8: Uint8Array): string {
  // Works in browsers. Avoids requiring Buffer polyfill.
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  // btoa expects binary string
  return btoa(s);
}
