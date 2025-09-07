import React, { useEffect, useMemo, useState } from "react";
import algosdk from "algosdk";
import { useWallet } from "@txnlab/use-wallet";
import { deployTrustGame } from "../deploy";
import { setPhase, sweepApp, deleteApp, setPair } from "../chain/tx";
import { resolveAppId, setSelectedAppId } from "../state/appId";
import { QRCodeCanvas } from "qrcode.react";

const nf = (n: number) => Intl.NumberFormat().format(n);

export default function AdminSetup2() {
  const { activeAddress, signTransactions } = useWallet();

  // Deploy inputs
  const [E1, setE1] = useState<number>(100_000);
  const [E2, setE2] = useState<number>(100_000);
  const [m, setM] = useState<number>(3);
  const [UNIT, setUNIT] = useState<number>(1_000);
  const [nNeeded, setNNeeded] = useState<number>(2); // display-only for now
  const [numContracts, setNumContracts] = useState<number>(1); // new: number of contracts
  // string mirrors to allow clean editing without forced leading zeros
  const [E1Str, setE1Str] = useState<string>("100000");
  const [E2Str, setE2Str] = useState<string>("100000");
  const [mStr, setMStr] = useState<string>("3");
  const [unitStr, setUnitStr] = useState<string>("1000");
  const [nNeededStr, setNNeededStr] = useState<string>("2");
  const [numContractsStr, setNumContractsStr] = useState<string>("1");

  // State
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<{ id: string; round?: number } | null>(null);

  // App identity
  const [appId, setAppId] = useState<number | null>(null);
  const [addr, setAddr] = useState<string | null>(null);

  // Manage existing pair
  const [manualAppId, setManualAppId] = useState<string>("");

  // Admin controls
  const [phaseSel, setPhaseSel] = useState<number>(1);
  const [showQr, setShowQr] = useState<boolean>(false); // legacy (no longer used for display)
  const [showFundQr, setShowFundQr] = useState<boolean>(false);

  // Compute conservative funding needed for Return: t + E2, where t = m*s and s ≤ E1
  const required = useMemo(() => (m - 1) * E1 + E2 + 50_000, [m, E1, E2]);
  const [fund, setFund] = useState<{ required: number; balance?: number; ok?: boolean } | null>(null);

  const signer = (u: Uint8Array[]) => signTransactions(u);
  const [currentPhase, setCurrentPhase] = useState<number | null>(null);
  const [history, setHistory] = useState<null | { loading: boolean; error?: string; items?: Array<{ round: number; time: number; txid: string; sender: string; event: string; details?: any; innerPayments?: Array<{ to: string; amount: number }> }> }>(null);
  // Creator/session guidance
  const creatorEnv = (import.meta as any)?.env?.VITE_CREATOR_ADDRESS as string | undefined;
  const [creatorOnChain, setCreatorOnChain] = useState<string | null>(null);
  const isCreator = !!activeAddress && (
    (!!creatorEnv && activeAddress === creatorEnv) || (!!creatorOnChain && activeAddress === creatorOnChain)
  );
  // Try to learn creator from on-chain app params when an App ID is selected
  useEffect(() => {
    (async () => {
      try {
        const id = resolveAppId();
        if (!Number.isInteger(id) || id <= 0) return;
        const r = await fetch(`/api/pair?id=${id}`);
        const j = await r.json().catch(() => ({} as any));
        const cr = j?.creator || j?.params?.creator || j?.application?.params?.creator;
        if (typeof cr === 'string' && cr.length >= 58) setCreatorOnChain(cr);
      } catch { /* ignore until App ID is set */ }
    })();
  }, [activeAddress, appId, manualAppId]);
  const [sessionStarted, setSessionStarted] = useState<boolean>(false);
  // Register Subjects modal
  const [showRegister, setShowRegister] = useState<boolean>(true);
  const [s1Temp, setS1Temp] = useState<string>("5LHXG4QJZDSFSX35HOIDG4WEQ43NWIVDTGAKYCUNGJZYNWW4JNBESWYD5U");
  const [s2Temp, setS2Temp] = useState<string>("Z6CHJQ2KVHUPRM2AEDT27XS3CHK4UWFNDBWASXMDJ4CJQB6EYR4CJEE7UU");
  // Recruit Subjects (S1/S2)
  const [s1Input, setS1Input] = useState<string>("");
  const [s2Input, setS2Input] = useState<string>("");
  const isAddr = (a: string) => {
    try { return !!a && (algosdk as any).isValidAddress?.(a) === true; } catch { return false; }
  };

  // helper to sanitize numeric text and update string+number states
  function handleNumInput(raw: string, setStr: (s: string) => void, setNum: (n: number) => void) {
    let v = (raw || '').replace(/[^\d]/g, '');
    if (v.length > 1) v = v.replace(/^0+/, ''); // strip leading zeros but keep single 0
    setStr(v);
    setNum(v === '' ? 0 : Number(v));
  }

  function loraTxUrl(txId: string) {
    return `https://lora.algokit.io/testnet/tx/${txId}`;
  }

  async function onDeploy() {
    setBusy("deploy"); setErr(null);
    try {
      if (!activeAddress) throw new Error("Connect the experimenter wallet first.");
      const r = await deployTrustGame({ sender: activeAddress, E1, E2, m, UNIT, sign: signer });
      setAppId(r.appId);
      setAddr(r.appAddress);
      setSelectedAppId(r.appId);
      setFund(null);
      // Explicit: do not auto-setPair; use Finish & Set Pair button so flow is obvious
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
    if (!activeAddress) return setErr("Connect the experimenter wallet.");
    setBusy("phase");
    try {
      await setPhase({ sender: activeAddress, appId: id, phase: p, sign: signer });
      setCurrentPhase(p);
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
      const ph = Number(j?.globals?.phase);
      if (Number.isFinite(ph)) setCurrentPhase(ph);
      // No special UI here; this validates the app exists and backend network matches
    } catch (e: any) { setErr(e?.message || String(e)); }
  }

  async function onLoadHistory() {
    setHistory({ loading: true });
    try {
      const id = resolveAppId();
      const r = await fetch(`/api/history?id=${id}&limit=100`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      const items = (j?.txns as any[] || []).map((t) => ({
        round: Number(t.round || 0),
        time: Number(t.time || 0),
        txid: String(t.txid || ''),
        sender: String(t.sender || ''),
        event: String(t.event || ''),
        details: t.details || {},
        innerPayments: Array.isArray(t.innerPayments) ? t.innerPayments : [],
      }));
      setHistory({ loading: false, items });
    } catch (e: any) {
      setHistory({ loading: false, error: e?.message || String(e) });
    }
  }

  async function onSweep() {
    setErr(null);
    try {
      const id = resolveAppId();
      if (!activeAddress) throw new Error("Connect the experimenter wallet.");
      const r = await sweepApp({ sender: activeAddress, appId: id, sign: (u)=>signTransactions(u), wait: true });
      setLastTx({ id: r.txId, round: r.confirmedRound });
    } catch (e: any) { setErr(e?.message || String(e)); }
  }

  async function onDelete() {
    setErr(null);
    try {
      const id = resolveAppId();
      if (!activeAddress) throw new Error("Connect the experimenter wallet.");
      if (!confirm(`Delete application ${id}? This cannot be undone.`)) return;
      const r = await deleteApp({ sender: activeAddress, appId: id, sign: (u)=>signTransactions(u), wait: true });
      setLastTx({ id: r.txId, round: r.confirmedRound });
    } catch (e: any) { setErr(e?.message || String(e)); }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <h3 className="text-lg font-semibold">Experimenter - Register Experiment</h3>

      {/* Start Session hidden to reduce confusion (admin actions still enforced on-chain) */}

      {/* Step 0 — Set Experimental Parameters */}
      <div className="text-sm font-bold">Set Experimental Parameters</div>
      <div className="text-xs text-neutral-700 mb-1">&nbsp;</div>
      {/* Deploy controls */}
      <div className="grid grid-cols-1 gap-3">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="text-sm">S1 Endowment (e1)</label>
          <input type="text" inputMode="numeric" pattern="\\d*" value={E1Str}
            onChange={(e)=>handleNumInput(e.target.value, setE1Str, setE1)} className="border rounded p-2 w-[15ch]" style={{ width: '15ch' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="text-sm">S2 Endowment (e2)</label>
          <input type="text" inputMode="numeric" pattern="\\d*" value={E2Str}
            onChange={(e)=>handleNumInput(e.target.value, setE2Str, setE2)} className="border rounded p-2 w-[15ch]" style={{ width: '15ch' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="text-sm">Multiplier (m)</label>
          <input type="text" inputMode="numeric" pattern="\\d*" value={mStr}
            onChange={(e)=>handleNumInput(e.target.value, setMStr, setM)} className="border rounded p-2 w-[15ch]" style={{ width: '15ch' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="text-sm">microAlgos step size</label>
          <input type="text" inputMode="numeric" pattern="\\d*" value={unitStr}
            onChange={(e)=>handleNumInput(e.target.value, setUnitStr, setUNIT)} className="border rounded p-2 w-[15ch]" style={{ width: '15ch' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="text-sm">Number of subjects (ns)</label>
          <input type="text" inputMode="numeric" pattern="\\d*" value={nNeededStr}
            onChange={(e)=>handleNumInput(e.target.value, setNNeededStr, setNNeeded)} className="border rounded p-2 w-[15ch]" style={{ width: '15ch' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label className="text-sm">Number of contracts (nc)</label>
          <input type="text" inputMode="numeric" pattern="\\d*" value={numContractsStr}
            onChange={(e)=>handleNumInput(e.target.value, setNumContractsStr, setNumContracts)} className="border rounded p-2 w-[15ch]" style={{ width: '15ch' }} />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button disabled={!!busy || !activeAddress} onClick={onDeploy} className="rounded-xl px-3 py-2 border">
          {busy === "deploy" ? "Deploying…" : "Deploy"}
        </button>
        {appId && <div className="text-sm">App ID: <code>{appId}</code>{' '}</div>}
      </div>
      {/* No spacer here; App Address follows immediately */}
      {/* Show App Address directly after App ID */}
      {addr && (
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <span>App Address:</span>
            <code className="break-all">{addr}</code>
            <button onClick={() => navigator.clipboard.writeText(addr)} className="text-xs underline" title="Copy to clipboard">Copy</button>
            <a className="text-xs underline" href={`https://lora.algokit.io/testnet/account/${addr}`} target="_blank" rel="noreferrer">View</a>
          </div>
          {/* QR code moved to funding section below */}
        </div>
      )}
      {/* explicit blank line before Register Subjects */}
      <div style={{ height: 14 }} />

      {/* Step 2 — Register Subjects (always visible; capture only; no on-chain) */}
      <div className="rounded-xl border p-3 space-y-2" style={{ marginTop: 12 }}>
        <div className="font-bold">Register Subjects</div>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col">
              <span>S1 address</span>
              <div className="flex items-center gap-2">
                <input className="border rounded px-2 py-1 flex-1" placeholder="S1 Algorand address" value={s1Temp} onChange={(e)=> setS1Temp(e.target.value.trim())} />
                <button type="button" className="text-xs underline" onClick={()=> activeAddress && setS1Temp(activeAddress)}>Use connected</button>
              </div>
              {!!s1Temp && !isAddr(s1Temp) && (<span className="text-[11px] text-red-600">Invalid address</span>)}
            </label>
            <label className="flex flex-col">
              <span>S2 address</span>
              <div className="flex items-center gap-2">
                <input className="border rounded px-2 py-1 flex-1" placeholder="S2 Algorand address" value={s2Temp} onChange={(e)=> setS2Temp(e.target.value.trim())} />
                <button type="button" className="text-xs underline" onClick={()=> activeAddress && setS2Temp(activeAddress)}>Use connected</button>
              </div>
              {!!s2Temp && !isAddr(s2Temp) && (<span className="text-[11px] text-red-600">Invalid address</span>)}
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="text-xs underline" onClick={()=>{ setS1Temp(""); setS2Temp(""); }}>Clear</button>
            <button className="text-xs underline" onClick={()=>{ setS1Input(s1Temp); setS2Input(s2Temp); }} disabled={!isAddr(s1Temp) || !isAddr(s2Temp)} title="Capture S1 and S2">Done</button>
          </div>
          {(s1Input || s2Input) && (
            <div className="text-xs text-neutral-700">
              Added — S1: <code>{s1Input || '(not set)'}</code> · S2: <code>{s2Input || '(not set)'}</code>
            </div>
          )}
        </div>
      </div>

      {/* Step 3 — Add Subjects to Experiment (experimenter-only on-chain) */}
      <div className="rounded-xl border p-3 space-y-2">
        <div className="h-4" />
        {/* label removed per request; keep a blank line */}
        <div className="flex items-center gap-2">
          <button className="text-xs underline"
            onClick={async ()=>{
              setErr(null);
              try {
                const id = resolveAppId();
                if (!isCreator) throw new Error('Connect the experimenter wallet');
                if (!isAddr(s1Input) || !isAddr(s2Input)) throw new Error('Capture S1 and S2 first');
                const r = await setPair({ sender: activeAddress!, appId: id, s1: s1Input, s2: s2Input, sign: signer, wait: true });
                setLastTx({ id: r.txId, round: r.confirmedRound });
              } catch (e: any) { setErr(e?.message || String(e)); }
            }}
            disabled={!isCreator || !isAddr(s1Input) || !isAddr(s2Input)}
            title={!isCreator ? 'Experimenter only' : (!isAddr(s1Input) || !isAddr(s2Input)) ? 'Capture S1/S2 first' : ''}
          >Add Subjects to Experiment</button>
        </div>
        <div className="h-4" />
      </div>
      {/* extra spacer after add-subjects card */}
      <div style={{ height: 12 }} />

      {/* Manage existing pair */}
      {!appId && (
        <div className="flex items-center gap-2 text-sm">
          <span>Use existing App ID:</span>
          <input type="number" min={1} inputMode="numeric" value={manualAppId}
            onChange={(e)=>{ setManualAppId(e.target.value); const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) setSelectedAppId(n); }}
            className="border rounded px-2 py-1 w-40" placeholder="e.g., 745000000" />
          <button className="text-xs underline" onClick={onReadPairState} disabled={!!busy || !manualAppId}>Read pair state</button>
          <button className="text-xs underline" onClick={()=>onApplyPhase(0)} disabled={!!busy || !activeAddress}>Phase: 0 (Registration)</button>
          <button className="text-xs underline" onClick={()=>onApplyPhase(1)} disabled={!!busy || !activeAddress}>Phase: 1 (Setup)</button>
          <button className="text-xs underline" onClick={()=>onApplyPhase(2)} disabled={!!busy || !activeAddress}>Phase: 2 (Invest)</button>
          <button className="text-xs underline" onClick={()=>onApplyPhase(3)} disabled={!!busy || !activeAddress}>Phase: 3 (Return/Done)</button>
          <button className="text-xs underline" onClick={onSweep} disabled={!!busy || !activeAddress}>Sweep</button>
        </div>
      )}

      {/* App funding */}
      {addr && (
        <div className="space-y-2">
          {/* explicit blank line before funding section */}
          <div style={{ height: 12 }} />
          <div className="text-sm font-semibold">Fund Experiment</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFundQr(v => !v)} className="text-xs underline">{showFundQr ? 'Hide Fund Session' : 'Fund Session'}</button>
            <button onClick={checkFunding} disabled={!!busy} className="text-xs underline">Check funding</button>
            <div className="text-xs text-neutral-700">Required pool (est): <span className="font-semibold">{nf(required)}</span> microAlgos</div>
            {fund && (
              <div className="text-xs text-neutral-700">
                Balance: {nf(fund.balance ?? 0)} μALGO · Required ≥ {nf(fund.required)} μALGO ({nf((m-1)*E1 + E2)} for t+E2)
              </div>
            )}
          </div>
          {showFundQr && (
            <div className="mt-2">
              <QRCodeCanvas value={addr!} size={128} />
            </div>
          )}
        </div>
      )}

      {/* Phase controls */}
      <div className="flex items-center gap-2 text-sm">
        <span>Set phase:</span>
        <select className="border rounded px-2 py-1" value={phaseSel} onChange={(e)=> setPhaseSel(Number(e.target.value))}>
          <option value={0}>0 (Registration)</option>
          <option value={1}>1 (Setup)</option>
          <option value={2}>2 (Invest)</option>
          <option value={3}>3 (Return/Done)</option>
        </select>
        <button className="text-xs underline" onClick={()=>onApplyPhase(phaseSel)} disabled={!!busy || !activeAddress}>Apply</button>
        <button className="text-xs underline" onClick={onReadPairState} disabled={!!busy}>Read pair state</button>
        {Number.isFinite(currentPhase as any) && (
          <span className="text-xs text-neutral-600">Current phase: <code>{currentPhase}</code></span>
        )}
        {/* Always show Sweep here so it's available even when appId is set */}
        <button className="text-xs underline" onClick={onSweep} disabled={!!busy || !activeAddress}>Sweep</button>
        <button className="text-xs underline" onClick={onLoadHistory} disabled={!!busy}>View history</button>
        <button
          className="text-xs underline text-red-700"
          onClick={onDelete}
          disabled={!!busy || !activeAddress || currentPhase !== 3}
          title={currentPhase === 3 ? 'Delete application (experimenter only). Sweep first to reclaim liquid.' : 'Enabled only in Done (3). Use Sweep first, then Delete.'}
        >
          Delete app
        </button>
      </div>

      {/* History viewer */}
      {history && (
        <div className="rounded-xl border p-3 space-y-2 text-xs text-neutral-800">
          <div className="flex items-center justify-between">
            <div className="font-semibold">History (last {history.items?.length ?? 0})</div>
            <button className="underline" onClick={()=>setHistory(null)}>Close</button>
          </div>
          {history.loading && <div>Loading…</div>}
          {history.error && <div className="text-red-600">{history.error}</div>}
          {!history.loading && !history.error && (
            <ul className="space-y-1">
              {(history.items || []).map((h, i) => (
                <li key={h.txid || i} className="flex items-start gap-2">
                  <div className="text-neutral-500 w-28">{h.time ? new Date(h.time * 1000).toLocaleString() : ''}</div>
                  <div className="flex-1">
                    <div>
                      <span className="font-medium">{h.event || '(noop)'}</span>
                      {' '}by <code>{h.sender?.slice(0,6)}…{h.sender?.slice(-6)}</code>
                      {' '}· <a href={loraTxUrl(h.txid)} target="_blank" rel="noreferrer" className="underline text-blue-700">LoRA</a>
                    </div>
                    {(() => {
                      const p = h.innerPayments || [];
                      if (!p.length) return null;
                      return (
                        <div>
                          <div>Payments:</div>
                          {p.map((x, idx) => (
                            <div key={idx} className="ml-4">{x.amount.toLocaleString()} → <code>{x.to.slice(0,6)}…{x.to.slice(-6)}</code></div>
                          ))}
                        </div>
                      );
                    })()}
                    {h.details && Object.keys(h.details).length > 0 && (
                      <div className="text-neutral-600">{JSON.stringify(h.details)}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="text-xs text-neutral-600">
        Deploy sets globals E1, E2, m, UNIT and phase = 0 (Registration). Use Set phase to advance to 1 (Invest), then 2 (Return), then 3 (Done).
        Funding guide:
        
        
        - Before Invest: app liquid ≥ (E1 − s) to refund S1’s leftover endowment.
        - Before Return: app liquid ≥ (t + E2) where t = m × s.
        - App must always keep ≥ 0.1 ALGO minimum; Sweep transfers only liquid = balance − min.
      </div>

      {lastTx && (
        <div className="text-xs">Last tx: <code>{lastTx.id}</code>{lastTx.round ? ` (round ${lastTx.round})` : ``}</div>
      )}

      {/* (Removed duplicate Step 2 button block; form is always visible above) */}

      {/* Step 3 — Add Subjects to Experiment (experimenter-only on-chain, duplicate block) */}
      <div className="rounded-xl border p-3 space-y-2">
        <div className="h-4" />
        {/* label removed per request; keep a blank line */}
        <div className="flex items-center gap-2">
          <button className="text-xs underline"
            onClick={async ()=>{
              setErr(null);
              try {
                const id = resolveAppId();
                if (!isCreator) throw new Error('Connect the experimenter wallet');
                if (!isAddr(s1Input) || !isAddr(s2Input)) throw new Error('Capture S1 and S2 first');
                const r = await setPair({ sender: activeAddress!, appId: id, s1: s1Input, s2: s2Input, sign: signer, wait: true });
                setLastTx({ id: r.txId, round: r.confirmedRound });
              } catch (e: any) { setErr(e?.message || String(e)); }
            }}
            disabled={!isCreator || !isAddr(s1Input) || !isAddr(s2Input)}
            title={!isCreator ? 'Experimenter only' : (!isAddr(s1Input) || !isAddr(s2Input)) ? 'Capture S1/S2 first' : ''}
          >Add Subjects to Experiment</button>
        </div>
        <div className="h-4" />
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}

      {/* (Overlay removed; inline capture above) */}
    </div>
  );
}

