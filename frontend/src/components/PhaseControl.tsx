// frontend/src/components/PhaseControl.tsx
// cspell:ignore itob
import React, { useCallback, useMemo, useState } from "react";
import * as algosdk from "algosdk";
import { useWallet } from "@txnlab/use-wallet";
import { Buffer } from "buffer"; // ensure Buffer exists in browser builds
import { useToast } from "./Toaster";
import {
  getParams,
  optInApp,
  register as registerAction,
  placeBid as placeBidAction,
  type Signer,
} from "../chain/tx";

type Props = {
  appId?: number | string;
  account?: string | null;
  network?: string; // display only
};

// use shared Pera instance from wallet.ts

function itob8(n: number): Uint8Array {
  const b = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    b[i] = n & 0xff;
    n >>>= 8;
  }
  return b;
}
const te = new TextEncoder();
const fromB64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

// Signing uses use-wallet-react hook

export default function PhaseControl({ appId, account, network }: Props) {
  const { activeAddress, activeAccount, signTransactions } = useWallet();
  const connectedAddress = activeAddress || activeAccount?.address || null;
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const resolvedAppId = useMemo(() => {
    if (appId) return Number(appId);
    const url = new URL(window.location.href);
    const q = url.searchParams.get("appId");
    if (q) return Number(q);
    const env = import.meta.env.VITE_TESTNET_APP_ID as string | undefined;
    return env ? Number(env) : undefined;
  }, [appId]);

  const loraTxUrl = useMemo(() => {
    if (!lastTxId) return null;
    const chain = (network || "TESTNET").toLowerCase() === "mainnet" ? "mainnet" : "testnet";
    return `https://lora.algokit.io/${chain}/tx/${lastTxId}`;
  }, [lastTxId, network]);

  // --- On-Chain Actions state ---
  const defaultId = useMemo(() => {
    const env = (import.meta.env.VITE_TESTNET_APP_ID as string) || "";
    return Number(env || resolvedAppId || 0) || 0;
  }, [resolvedAppId]);
  const [ocAppId, setOcAppId] = useState<number>(defaultId);
  const [fakeId, setFakeId] = useState<string>(
    "SMOKE_" + new Date().toISOString().slice(0, 10)
  );
  const [microAlgos, setMicroAlgos] = useState<number>(100000);
  const [ocBusy, setOcBusy] = useState<string | null>(null);
  const [ocLastTxId, setOcLastTxId] = useState<string | null>(null);
  const [ocConfirmedRound, setOcConfirmedRound] = useState<number | null>(null);
  const [ocError, setOcError] = useState<string | null>(null);
  const netLower = (import.meta.env.VITE_NETWORK as string | undefined || "testnet").toLowerCase();
  const txUrl = useCallback((txId: string) => {
    const chain = netLower === "mainnet" ? "mainnet" : "testnet";
    return `https://lora.algokit.io/${chain}/tx/${txId}`;
  }, [netLower]);

  const signer: Signer = useCallback((txns) => signTransactions(txns), [signTransactions]);
  const pollConfirmedRound = useCallback(async (txId: string): Promise<number | null> => {
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const r = await fetch(`/api/pending?txid=${txId}`);
        const j = await r.json();
        const confirmed = j["confirmed-round"];
        if (confirmed) return Number(confirmed);
      } catch {}
    }
    return null;
  }, []);

  async function run<T>(label: string, fn: () => Promise<T>) {
    setOcBusy(label); setOcError(null); setOcLastTxId(null); setOcConfirmedRound(null);
    try {
      const res: any = await fn();
      if (res?.txId) setOcLastTxId(res.txId);
      if (res?.confirmedRound) setOcConfirmedRound(res.confirmedRound);
    } catch (e: any) {
      const msg = e?.response?.text ?? e?.message ?? String(e);
      setOcError(msg);
      try { toast.error(msg); } catch {}
      console.error(e);
    } finally {
      setOcBusy(null);
    }
  }

  const onGetParams = useCallback(() => run("Get Params", async () => {
    const sp = await getParams();
    const round = (sp as any).lastRound ?? (sp as any)["last-round"] ?? (sp as any).firstRound;
    try { toast.success(`Params OK (round ${String(round)})`); } catch {}
    return {} as any;
  }), [toast]);

  const onOptIn = useCallback(() => run("Opt-In", async () => {
    const sender = connectedAddress || account;
    if (!sender) throw new Error(`Connect wallet on ${netLower} to opt-in.`);
    if (!Number.isInteger(ocAppId) || ocAppId <= 0) throw new Error("Enter a valid App ID.");
    const { txId } = await optInApp({ appId: ocAppId, sender, sign: signer });
    const cr = await pollConfirmedRound(txId);
    if (cr) setOcConfirmedRound(cr);
    try { toast.success("Opt-In submitted"); } catch {}
    return { txId, confirmedRound: cr } as any;
  }), [connectedAddress, account, ocAppId, signer, pollConfirmedRound, netLower, toast]);

  const onRegister = useCallback(() => run("Register", async () => {
    const sender = connectedAddress || account;
    if (!sender) throw new Error(`Connect wallet on ${netLower} to register.`);
    if (!Number.isInteger(ocAppId) || ocAppId <= 0) throw new Error("Enter a valid App ID.");
    if (!fakeId) throw new Error("Enter a Fake ID string.");
    const { txId } = await registerAction({ appId: ocAppId, sender, fakeId, sign: signer });
    const cr = await pollConfirmedRound(txId);
    if (cr) setOcConfirmedRound(cr);
    try { toast.success("Register submitted"); } catch {}
    return { txId, confirmedRound: cr } as any;
  }), [connectedAddress, account, ocAppId, fakeId, signer, pollConfirmedRound, netLower, toast]);

  const onBid = useCallback(() => run("Place Bid", async () => {
    const sender = connectedAddress || account;
    if (!sender) throw new Error(`Connect wallet on ${netLower} to place a bid.`);
    if (!Number.isInteger(ocAppId) || ocAppId <= 0) throw new Error("Enter a valid App ID.");
    if (!Number.isInteger(microAlgos) || microAlgos < 0) throw new Error("Bid must be a non-negative integer (µAlgos).");
    const { txId } = await placeBidAction({ appId: ocAppId, sender, microAlgos, sign: signer });
    const cr = await pollConfirmedRound(txId);
    if (cr) setOcConfirmedRound(cr);
    try { toast.success("Bid submitted"); } catch {}
    return { txId, confirmedRound: cr } as any;
  }), [connectedAddress, account, ocAppId, microAlgos, signer, pollConfirmedRound, netLower, toast]);

  async function setPhase(phase: number) {
    try {
      setErr(null);
      if (!resolvedAppId) throw new Error("No App ID");
      const sender = (account ?? connectedAddress) || null;
      if (!sender) throw new Error("Wallet not connected");
      if (!algosdk.isValidAddress(sender)) throw new Error("Invalid wallet address");
      setBusy(phase);

      // 1) fetch algorand params from API
      const p = await fetch("/api/params").then((r) => r.json());
      const last = Number(p["last-round"] ?? p["lastRound"] ?? 0);
      const minFee = Number(p["min-fee"] ?? p.fee ?? 1000) || 1000;
      const gh = (p["genesis-hash"] ?? p.genesishashb64 ?? p.genesisHash) as string;

      // 2) normalize to SuggestedParams with broad SDK compatibility
      const sp: algosdk.SuggestedParams = {
        fee: minFee,
        minFee: minFee,
        flatFee: true,
        firstValid: last,
        lastValid: last + 1000,
        // include legacy aliases for certain SDK helpers
        firstRound: last as any,
        lastRound: (last + 1000) as any,
        genesisID: (p["genesis-id"] ?? p.genesisID) as string,
        genesisHash: fromB64(gh),
      } as any;

      // 3) build NoOp using v3-friendly helper
      const appArgs = [te.encode("set_phase"), itob8(phase)];
      const fromAddr = (sender as string).trim();
      
      // Additional validation before creating transaction
      if (!fromAddr || fromAddr === "") throw new Error("Address is empty");
      if (!algosdk.isValidAddress(fromAddr)) throw new Error("Address is invalid for transaction");
      
      const txn = algosdk.makeApplicationCallTxnFromObject({
        sender: fromAddr,
        appIndex: resolvedAppId as number,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs,
        suggestedParams: sp,
      } as any);

      // 4) sign with Pera and submit
      const signed = await signTransactions([txn.toByte()]);
      const raw = signed?.[0];
      const signedTxnBase64 = Buffer.from(raw).toString("base64");

      const resp = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedTxnBase64 }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || JSON.stringify(j));
      setLastTxId(j.txId || j.txid || null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  const disabled = !resolvedAppId || !(account ?? connectedAddress) || !algosdk.isValidAddress((account ?? connectedAddress) as string);

  return (
    <div style={{ marginTop: 16, border: "1px solid #ddd", padding: 12, borderRadius: 8, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong>Phase Control</strong>
        <span style={{ fontSize: 12, color: "#666" }}>App ID: {resolvedAppId ?? "—"}</span>
      </div>
      <div style={{ marginTop: 6, color: "#444", fontSize: 13 }}>
        Switch experiment phases on-chain (1=registration, 2=commit, 3=reveal).
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => setPhase(1)}
          disabled={disabled || busy !== null}
          style={{ background: "#f5f5f5", border: "1px solid #ccc", padding: "8px 12px", borderRadius: 6, fontSize: 13 }}
        >
          {busy === 1 ? "Setting…" : "Phase 1: Registration"}
        </button>
        <button
          onClick={() => setPhase(2)}
          disabled={disabled || busy !== null}
          style={{ background: "#f5f5f5", border: "1px solid #ccc", padding: "8px 12px", borderRadius: 6, fontSize: 13 }}
        >
          {busy === 2 ? "Setting…" : "Phase 2: Commit"}
        </button>
        <button
          onClick={() => setPhase(3)}
          disabled={disabled || busy !== null}
          style={{ background: "#f5f5f5", border: "1px solid #ccc", padding: "8px 12px", borderRadius: 6, fontSize: 13 }}
        >
          {busy === 3 ? "Setting…" : "Phase 3: Reveal"}
        </button>
      </div>

      {err && <div style={{ marginTop: 8, color: "#b00", fontSize: 12 }}>Error: {err}</div>}

      {lastTxId && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          TxID: <code>{lastTxId}</code>
          {loraTxUrl && (
            <>
              {" "}— <a href={loraTxUrl} target="_blank" rel="noreferrer">View in Lora</a>
            </>
          )}
        </div>
      )}

      {disabled && (
        <div style={{ marginTop: 8, color: "#b07", fontSize: 12 }}>
          Connect wallet and ensure an App ID (deploy once or set <code>VITE_TESTNET_APP_ID</code>).
      </div>
    )}
      {/* On-Chain Actions */}
      <div style={{ marginTop: 12, border: "1px solid #ddd", padding: 12, borderRadius: 8, background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong>On-Chain Actions</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>App ID</span>
            <input type="number" value={ocAppId} onChange={(e)=>setOcAppId(Number(e.target.value||0))} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Fake ID</span>
            <input type="text" value={fakeId} onChange={(e)=>setFakeId(e.target.value)} placeholder="SMOKE_YYYY-MM-DD_KAM" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Bid (µAlgos)</span>
            <input type="number" min={0} value={microAlgos} onChange={(e)=>setMicroAlgos(Number(e.target.value||0))} />
          </label>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={!!ocBusy} onClick={onGetParams}>Get Params</button>
          <button disabled={!connectedAddress || !!ocBusy || !(Number.isInteger(ocAppId) && ocAppId>0)} onClick={onOptIn}>Opt-In</button>
          <button disabled={!connectedAddress || !!ocBusy || !(Number.isInteger(ocAppId) && ocAppId>0)} onClick={onRegister}>Register</button>
          <button disabled={!connectedAddress || !!ocBusy || !(Number.isInteger(ocAppId) && ocAppId>0) || !(Number.isInteger(microAlgos) && microAlgos>=0)} onClick={onBid}>Place Bid</button>
        </div>
        {(ocLastTxId || ocError) && (
          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
            {ocLastTxId && (
              <div>
                <div>txId: <code>{ocLastTxId}</code></div>
                {ocConfirmedRound && <div>confirmed-round: {ocConfirmedRound}</div>}
                <div><a href={txUrl(ocLastTxId)} target="_blank" rel="noreferrer">View in Lora</a></div>
              </div>
            )}
            {ocError && (
              <div style={{ color: "#b00" }}>error: {ocError}</div>
            )}
          </div>
        )}
      </div>
      </div>
  );
}
