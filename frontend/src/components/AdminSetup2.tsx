import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet";
import { deployTrustGame } from "../deploy";
import { setPhase, sweepApp } from "../chain/tx";
import { resolveAppId, setSelectedAppId } from "../state/appId";

const nf = (n: number) => Intl.NumberFormat().format(n);

export default function AdminSetup2() {
  const { activeAddress, signTransactions } = useWallet();

  // Deploy inputs
  const [E1, setE1] = useState<number>(100_000);
  const [E2, setE2] = useState<number>(100_000);
  const [m, setM] = useState<number>(3);
  const [UNIT, setUNIT] = useState<number>(1_000);

  // State
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<{ id: string; round?: number } | null>(null);

  // App identity
  const [appId, setAppId] = useState<number | null>(null);
  const [addr, setAddr] = useState<string | null>(null);

  // Manage existing pair
  const [manualAppId, setManualAppId] = useState<string>("");

  // Compute conservative funding needed for Return: t + E2, where t = m*s and s ≤ E1
  const required = useMemo(() => (m - 1) * E1 + E2 + 50_000, [m, E1, E2]);
  const [fund, setFund] = useState<{ required: number; balance?: number; ok?: boolean } | null>(null);

  const signer = (u: Uint8Array[]) => signTransactions(u);

  async function onDeploy() {
    setBusy("deploy"); setErr(null);
    try {
      if (!activeAddress) throw new Error("Connect the experimenter wallet first.");
      const r = await deployTrustGame({ sender: activeAddress, E1, E2, m, UNIT, sign: signer });
      setAppId(r.appId);
      setAddr(r.appAddress);
      setSelectedAppId(r.appId);
      setFund(null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setBusy(null); }
  }

  async function checkFunding() {
    if (!addr) return;
    setBusy("fund"); setErr(null);
    try {
      const r = await fetch(`/api/account?addr=${encodeURIComponent(addr)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      const bal = Number(j?.amount ?? 0);
      setFund({ required, balance: bal, ok: bal >= required });
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setBusy(null); }
  }

  async function onApplyPhase(p: number) {
    setErr(null);
    if (manualAppId) {
      const idNum = Number(manualAppId);
      if (Number.isFinite(idNum) && idNum > 0) setSelectedAppId(idNum);
    } else if (appId) {
      setSelectedAppId(appId);
    }
    let id: number;
    try { id = resolveAppId(); } catch (e: any) { return setErr(e?.message || String(e)); }
    if (!activeAddress) return setErr("Connect the creator wallet.");
    setBusy("phase");
    try {
      await setPhase({ sender: activeAddress, appId: id, phase: p, sign: signer });
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setBusy(null); }
  }

  async function onReadPairState() {
    setErr(null);
    try {
      const id = resolveAppId();
      const r = await fetch(`/api/pair?id=${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      // No special UI here; this validates the app exists and backend network matches
    } catch (e: any) { setErr(e?.message || String(e)); }
  }

  async function onSweep() {
    setErr(null);
    try {
      const id = resolveAppId();
      if (!activeAddress) throw new Error("Connect the creator wallet.");
      const r = await sweepApp({ sender: activeAddress, appId: id, sign: (u)=>signTransactions(u), wait: true });
      setLastTx({ id: r.txId, round: r.confirmedRound });
    } catch (e: any) { setErr(e?.message || String(e)); }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <h3 className="text-lg font-semibold">Admin - Deploy & Manage Pair</h3>

      {/* Deploy controls */}
      <div className="grid grid-cols-4 gap-3">
        <label className="flex flex-col">
          <span className="text-sm">E1 (S1 off-chain)</span>
          <input type="number" min={0} step={UNIT || 1} value={E1}
            onChange={(e)=>setE1(Number(e.target.value))} className="border rounded p-2" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">E2 (S2 at Return)</span>
          <input type="number" min={0} step={UNIT || 1} value={E2}
            onChange={(e)=>setE2(Number(e.target.value))} className="border rounded p-2" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">Multiplier m</span>
          <input type="number" min={1} step={1} value={m}
            onChange={(e)=>setM(Number(e.target.value))} className="border rounded p-2" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">UNIT (microAlgos step)</span>
          <input type="number" min={1} step={1} value={UNIT}
            onChange={(e)=>setUNIT(Number(e.target.value))} className="border rounded p-2" />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button disabled={!!busy || !activeAddress} onClick={onDeploy} className="rounded-xl px-3 py-2 border">
          {busy === "deploy" ? "Deploying…" : "Deploy"}
        </button>
        {appId && <div className="text-sm">App ID: <code>{appId}</code></div>}
      </div>

      {/* Manage existing pair */}
      {!appId && (
        <div className="flex items-center gap-2 text-sm">
          <span>Use existing App ID:</span>
          <input type="number" min={1} inputMode="numeric" value={manualAppId}
            onChange={(e)=>{ setManualAppId(e.target.value); const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) setSelectedAppId(n); }}
            className="border rounded px-2 py-1 w-40" placeholder="e.g., 745000000" />
          <button className="text-xs underline" onClick={onReadPairState} disabled={!!busy || !manualAppId}>Read pair state</button>
          <button className="text-xs underline" onClick={()=>onApplyPhase(0)} disabled={!!busy || !activeAddress}>Phase: Registration(0)</button>
          <button className="text-xs underline" onClick={()=>onApplyPhase(1)} disabled={!!busy || !activeAddress}>Phase: Invest(1)</button>
          <button className="text-xs underline" onClick={()=>onApplyPhase(2)} disabled={!!busy || !activeAddress}>Phase: Return(2)</button>
          <button className="text-xs underline" onClick={()=>onApplyPhase(3)} disabled={!!busy || !activeAddress}>Phase: Done(3)</button>
          <button className="text-xs underline" onClick={onSweep} disabled={!!busy || !activeAddress}>Sweep</button>
        </div>
      )}

      {/* App address + funding */}
      {addr && (
        <div className="space-y-2">
          <div className="text-sm flex items-center gap-2">
            <span>App Address:</span>
            <code className="break-all">{addr}</code>
            <button onClick={() => navigator.clipboard.writeText(addr)} className="text-xs underline" title="Copy to clipboard">Copy</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={checkFunding} disabled={!!busy} className="text-xs underline">Check funding</button>
            {fund && (
              <div className="text-xs text-neutral-700">
                Balance: {nf(fund.balance ?? 0)} μALGO · Required ≥ {nf(fund.required)} μALGO ({nf((m-1)*E1 + E2)} for t+E2)
              </div>
            )}
          </div>
        </div>
      )}

      {lastTx && (
        <div className="text-xs">Last tx: <code>{lastTx.id}</code>{lastTx.round ? ` (round ${lastTx.round})` : ``}</div>
      )}
      {err && <div className="text-sm text-red-600">{err}</div>}
    </div>
  );
}

