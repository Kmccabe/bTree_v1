import React, { useEffect, useState } from "react";
import { useWallet } from "@txnlab/use-wallet";
import { investFlow } from "../chain/tx";

export default function SubjectActions() {
  const { activeAddress, signTransactions } = useWallet();
  const [appIdIn, setAppIdIn] = useState<string>("");
  const [unit, setUnit] = useState<number>(1000);
  const [E, setE] = useState<number>(100000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [s, setS] = useState<number>(0);
  const [lastTx, setLastTx] = useState<string | null>(null);

  // read globals to get UNIT and E for input stepping
  async function readGlobals() {
    const id = Number(appIdIn);
    if (!Number.isFinite(id) || id <= 0) return setErr("Enter a valid App ID.");
    setBusy("read"); setErr(null);
    try {
      const r = await fetch(`/api/pair?id=${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setUnit(Number(j?.globals?.UNIT ?? 1000));
      setE(Number(j?.globals?.E ?? 100000));
    } catch (e:any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function doInvest() {
    const id = Number(appIdIn);
    if (!activeAddress) return setErr("Connect wallet as subject.");
    if (!Number.isFinite(id) || id <= 0) return setErr("Enter a valid App ID.");
    setBusy("invest"); setErr(null);
    try {
      const r = await investFlow({
        sender: activeAddress,
        appId: id,
        s,
        sign: (u) => signTransactions(u),
      });
      setLastTx(r.txId);
    } catch (e:any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <h3 className="text-lg font-semibold">Subject — Invest</h3>

      <div className="flex items-center gap-2 text-sm">
        <span>App ID:</span>
        <input
          type="number"
          className="border rounded px-2 py-1 w-44"
          value={appIdIn}
          onChange={(e)=>setAppIdIn(e.target.value)}
          placeholder="paste App ID"
        />
        <button className="text-xs underline" onClick={readGlobals} disabled={!!busy || !appIdIn}>
          Load globals
        </button>
        <span className="text-xs text-neutral-600">UNIT: {unit} · E: {E}</span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span>Invest s (µAlgos):</span>
        <input
          type="number"
          className="border rounded px-2 py-1 w-44"
          step={unit}
          min={0}
          max={E}
          value={s}
          onChange={(e)=>setS(Number(e.target.value))}
        />
        <button className="text-xs underline"
          onClick={doInvest}
          disabled={!!busy || !activeAddress || !appIdIn}>
          {busy==="invest" ? "Investing…" : "Invest"}
        </button>
      </div>

      {lastTx && <div className="text-xs">TxID: <code>{lastTx}</code></div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
      <p className="text-xs text-neutral-500">Wallet must be opted-in; phase must be 2; s must be a multiple of UNIT.</p>
    </div>
  );
}

