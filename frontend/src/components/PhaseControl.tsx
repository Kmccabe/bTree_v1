// frontend/src/components/PhaseControl.tsx
// cspell:ignore itob
import React, { useMemo, useState } from "react";
import * as algosdk from "algosdk";
import { useWallet } from "@txnlab/use-wallet";
import { Buffer } from "buffer"; // ensure Buffer exists in browser builds

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
      const signed = await signTransactions([txn]);
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
  </div>
  );
}
