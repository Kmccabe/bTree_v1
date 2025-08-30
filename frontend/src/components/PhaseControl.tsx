// frontend/src/components/PhaseControl.tsx
// cspell:ignore itob
import React, { useMemo, useState } from "react";
import * as algosdk from "algosdk";
import { pera, ensurePeraSession } from "../wallet";
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

// Some versions of @perawallet/connect typings don’t expose signTransaction.
// Use a small helper with a safe cast and fallback to signTransactions if present.
async function signWithPera(txn: algosdk.Transaction): Promise<Uint8Array> {
  const anyPera: any = pera as any;
  const sign = anyPera.signTransaction || anyPera.signTransactions;
  if (!sign) throw new Error("Pera sign method is unavailable");
  const groups = await sign.call(pera, [[{ txn }]]);
  const maybe = Array.isArray(groups) ? groups[0] : groups;
  const raw: Uint8Array | undefined = Array.isArray(maybe) ? (maybe[0] as any) : (maybe as any);
  if (!(raw && raw instanceof Uint8Array)) throw new Error("No signature from Pera");
  return raw;
}

export default function PhaseControl({ appId, account, network }: Props) {
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
      if (!account) throw new Error("Wallet not connected");
      if (!algosdk.isValidAddress(account)) throw new Error("Invalid wallet address");
      setBusy(phase);

      // Make sure Pera session is initialized to avoid wallet SDK init errors
      await ensurePeraSession();

      // 1) fetch algorand params from API
      const p = await fetch("/api/params").then((r) => r.json());
      const last = Number(p["last-round"] ?? p["lastRound"] ?? 0);

      // 2) normalize to SuggestedParams (typesafe)
      const sp: algosdk.SuggestedParams = {
        fee: Number(p.fee ?? p["min-fee"] ?? 1000),
        flatFee: true,
        // v3 types use firstValid/lastValid
        firstValid: last,
        lastValid: last + 1000,
        genesisID: (p["genesis-id"] ?? p.genesisID) as string,
        // v3 types accept Uint8Array for genesisHash
        genesisHash: fromB64((p["genesis-hash"] ?? p.genesisHash) as string),
      } as any;

      // 3) build NoOp using v3-friendly helper
      const appArgs = [te.encode("set_phase"), itob8(phase)];
      const fromAddr = (account as string).trim();
      
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
      const raw = await signWithPera(txn);
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

  const disabled = !resolvedAppId || !account || !algosdk.isValidAddress(account);

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
          Connect Pera and ensure an App ID (deploy once or set <code>VITE_TESTNET_APP_ID</code>).
        </div>
      )}
    </div>
  );
}
