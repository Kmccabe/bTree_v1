import React, { useEffect, useState } from "react";
import { useWallet } from "@txnlab/use-wallet";
import { deployTrustGame } from "../deploy";
import { setPhase, sweepApp } from "../chain/tx";
import { resolveAppId, setSelectedAppId } from "../state/appId";
import QRCode from "qrcode";

const nf = (n: number) => Intl.NumberFormat().format(n);

export default function AdminSetup() {
  const { activeAddress, signTransactions } = useWallet();

  // Deploy inputs
  const [E, setE] = useState<number>(100_000);
  const [m, setM] = useState<number>(3);
  const [UNIT, setUNIT] = useState<number>(1_000);

  // State
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // App identity
  const [appId, setAppId] = useState<number | null>(null);
  const [addr, setAddr] = useState<string | null>(null);

  // Allow managing an already-created pair
  const [manualAppId, setManualAppId] = useState<string>("");

  // Funding check
  const [fund, setFund] = useState<{ required: number; balance?: number; ok?: boolean } | null>(null);
  const required = (m - 1) * E + 50_000; // conservative buffer

  // Phase control
  const [phaseIn, setPhaseIn] = useState<number>(2);
  const [globals, setGlobals] = useState<any | null>(null);
  const [lastTx, setLastTx] = useState<{ id: string; round?: number } | null>(null);

  // QR code for App Address
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (addr && showQR) {
        try {
          const url = await QRCode.toDataURL(addr, { width: 200, margin: 1 });
          if (!cancelled) setQrDataUrl(url);
        } catch {
          if (!cancelled) setQrDataUrl(null);
        }
      } else {
        setQrDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [addr, showQR]);

  // convenience signer
  const signer = (u: Uint8Array[]) => signTransactions(u);

  async function onDeploy() {
    setBusy("deploy"); setErr(null);
    try {
      if (!activeAddress) throw new Error("Connect the experimenter wallet first.");
      const r = await deployTrustGame({ sender: activeAddress, E, m, UNIT, sign: signer });
      setAppId(r.appId);
      setAddr(r.appAddress);
      // Persist the newly deployed App ID for the session
      setSelectedAppId(r.appId);
      setFund(null);
      setGlobals(null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
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
    } finally {
      setBusy(null);
    }
  }

  async function onApplyPhase() {
    setErr(null);
    if (manualAppId) {
      const idNum = Number(manualAppId);
      if (Number.isFinite(idNum) && idNum > 0) setSelectedAppId(idNum);
    } else if (appId) {
      setSelectedAppId(appId);
    }
    // Use the centralized resolver for the active App ID
    let id: number;
    try {
      id = resolveAppId();
    } catch (e: any) {
      return setErr(e?.message || String(e));
    }
    console.info("[appId] resolved =", id);
    console.info("[AdminSetup] onApplyPhase", { activeAddress, id, phaseIn });
    if (!activeAddress) return setErr("Connect the creator wallet.");
    if (!Number.isFinite(id) || id <= 0) return setErr("Enter a numeric App ID.");
    setBusy("phase");
    try {
      await setPhase({ sender: activeAddress, appId: id, phase: phaseIn, sign: signer });
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onReadPairState() {
    let id: number;
    if (manualAppId) {
      const idNum = Number(manualAppId);
      if (Number.isFinite(idNum) && idNum > 0) setSelectedAppId(idNum);
    } else if (appId) {
      setSelectedAppId(appId);
    }
    try {
      id = resolveAppId();
    } catch (e: any) {
      return setErr(e?.message || String(e));
    }
    console.info("[appId] resolved =", id);
    if (!Number.isFinite(id) || id <= 0) return setErr("Enter a valid App ID.");
    setBusy("pair"); setErr(null);
    try {
      const r = await fetch(`/api/pair?id=${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setGlobals(j?.globals || null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onSweep() {
    setErr(null);
    try {
      const id = resolveAppId();
      if (!activeAddress) throw new Error("Connect the creator wallet.");
      const r = await sweepApp({ sender: activeAddress, appId: id, sign: (u)=>signTransactions(u), wait: true });
      setLastTx({ id: r.txId, round: r.confirmedRound });
      await onReadPairState();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <h3 className="text-lg font-semibold">Admin - Deploy & Manage Pair</h3>

      {/* Deploy controls */}
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col">
          <span className="text-sm">Endowment E (microAlgos)</span>
          <input type="number" min={0} step={UNIT || 1} value={E}
            onChange={(e)=>setE(Number(e.target.value))} className="border rounded p-2" />
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
        <button
          disabled={!!busy || !activeAddress}
          onClick={onDeploy}
          className="rounded-xl px-3 py-2 border"
        >
          {busy === "deploy" ? "Deploying…" : "Deploy"}
        </button>
        {appId && <div className="text-sm">App ID: <code>{appId}</code></div>}
      </div>

      {/* Manage existing pair */}
      {!appId && (
        <div className="flex items-center gap-2 text-sm">
          <span>Use existing App ID:</span>
          <input
            type="number" min={1} inputMode="numeric"
            value={manualAppId}
            onChange={(e)=>{
              setManualAppId(e.target.value);
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) setSelectedAppId(n);
            }}
            className="border rounded px-2 py-1 w-40"
            placeholder="e.g., 745000000"
          />
          <button
            className="text-xs underline"
            onClick={onReadPairState}
            disabled={!!busy || !manualAppId}
          >
            Read pair state</button>
        {globals?.phase === 3 && (
          <button className="text-xs underline" disabled={!!busy || !activeAddress || (globals?.swept === 1)} onClick={onSweep} title={(globals?.swept === 1) ? "Already swept" : "Sweep liquid funds to creator"}>
            {(globals?.swept === 1) ? "Swept" : "Sweep funds"}
          </button>
        )}
        </div>
      )}

      {/* App address + funding */}
      {addr && (
        <div className="space-y-2">
          <div className="text-sm flex items-center gap-2">
            <span>App Address:</span>
            <code className="break-all">{addr}</code>
            <button
              onClick={() => navigator.clipboard.writeText(addr)}
              className="text-xs underline"
              title="Copy to clipboard"
            >
              Copy
            </button>
            <button
              onClick={() => setShowQR(v => !v)}
              className="text-xs underline"
              title="Show QR for mobile scan"
            >
              {showQR ? "Hide QR" : "Show QR"}
            </button>
            <a
              href={`https://testnet.algoexplorer.io/address/${addr}`}
              target="_blank" rel="noreferrer"
              className="text-xs underline"
            >
              View
            </a>
          </div>
          {showQR && qrDataUrl && (
            <div className="p-2 border inline-block rounded">
              <img src={qrDataUrl} width={200} height={200} alt="App Address QR" />
            </div>
          )}
          <div className="text-sm">
            Required pool (est.): <b>{nf(required)}</b> microAlgos ·
            <button onClick={checkFunding} disabled={!!busy} className="underline ml-2">Check funding</button>
            {fund && (
              <span className={`ml-2 ${fund.ok ? "text-green-600" : "text-amber-600"}`}>
                {fund.balance != null ? `Balance ${nf(fund.balance)} microAlgos` : ""} {fund.ok ? "(OK)" : "(Needs funds)"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Phase control */}
      <div className="flex items-center gap-2 text-sm">
        <span>Set phase:</span>
        <select
          value={phaseIn}
          onChange={(e)=>setPhaseIn(Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {[1,2,3,4].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          className="text-xs underline"
          disabled={!!busy || (!appId && !manualAppId) || !activeAddress}
          onClick={onApplyPhase}
        >
          Apply
        </button>
        <button
          className="text-xs underline"
          disabled={!!busy || (!appId && !manualAppId)}
          onClick={onReadPairState}
        >
          Read pair state
        </button>
      </div>

      {/* Show decoded globals if available */}
      {globals && (
        <div className="text-xs text-neutral-700">
          E: {globals.E ?? "?"} · m: {globals.m ?? "?"} · UNIT: {globals.UNIT ?? "?"} · phase: {globals.phase ?? "?"}
        </div>
      )}

      {lastTx && (
        <div className="text-xs text-neutral-700">
          Last admin tx: <code>{lastTx.id}</code>{lastTx.round ? ` � round ${lastTx.round}` : ""} � <a className="underline" href={`https://lora.algokit.io/testnet/tx/${lastTx.id}`} target="_blank" rel="noreferrer">View on LoRA</a>
        </div>
      )}

      {err && <div className="text-sm text-red-600">{err}</div>}

      <p className="text-xs text-neutral-500">
        Deploy sets globals E, m, UNIT and phase=1. Use Set phase to advance to 2 (invest), then 3 (return).
      </p>
    </div>
  );
}



