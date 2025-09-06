import React, { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet';
import algosdk from 'algosdk';
import { registerExperiment } from '../chain/tx';
import { resolveAppId } from '../state/appId';

type Globals = {
  exp_registered?: number;
  exp_ts?: number;
  n_needed?: number;
  params_hash_b64?: string; // base64 of 32 bytes
  contract_uri?: string;
  phase?: number;
};

function b64ToHex(b64?: string): string {
  try {
    if (!b64) return '';
    const u8 = Uint8Array.from(Buffer.from(b64, 'base64'));
    return Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

function toBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

export default function ExperimentStatus() {
  const { activeAddress, signTransactions } = useWallet();
  const [globals, setGlobals] = useState<Globals | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [uri, setUri] = useState<string>('');
  const [nNeeded, setNNeeded] = useState<number>(20);
  const [hexInput, setHexInput] = useState<string>('');
  const [fileDigestB64, setFileDigestB64] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const appIdFromEnv = useMemo(() => {
    const raw = (import.meta as any).env?.VITE_APP_ID as string | undefined;
    const rawCompat = (import.meta as any).env?.VITE_TESTNET_APP_ID as string | undefined;
    const n = raw ? Number(raw) : (rawCompat ? Number(rawCompat) : NaN);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  }, []);
  const appId = useMemo(() => {
    try { return resolveAppId(); } catch { return appIdFromEnv; }
  }, [appIdFromEnv]);

  const creatorEnv = (import.meta as any).env?.VITE_CREATOR_ADDRESS as string | undefined;
  const isCreator = !!activeAddress && !!creatorEnv && activeAddress === creatorEnv;

  async function loadGlobals() {
    if (!appId) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/pair?id=${appId}`);
      const j: any = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      const g = j?.globals || {};
      const out: Globals = {
        exp_registered: typeof g.exp_registered === 'number' ? g.exp_registered : undefined,
        exp_ts: typeof g.exp_ts === 'number' ? g.exp_ts : undefined,
        n_needed: typeof g.n_needed === 'number' ? g.n_needed : undefined,
        params_hash_b64: (g?.params_hash && typeof g.params_hash?.bytes === 'string') ? g.params_hash.bytes : (typeof g.params_hash === 'string' ? g.params_hash : undefined),
        contract_uri: typeof g.contract_uri?.str === 'string' ? g.contract_uri.str : (typeof g.contract_uri === 'string' ? g.contract_uri : undefined),
        phase: typeof g.phase === 'number' ? g.phase : undefined,
      };
      setGlobals(out);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadGlobals(); }, [appId, activeAddress]);

  async function onFileChange(file?: File | null) {
    setErr(null);
    setFileDigestB64('');
    try {
      if (!file) return;
      const buf = await file.arrayBuffer();
      const dig = await crypto.subtle.digest('SHA-256', buf);
      const u8 = new Uint8Array(dig);
      setFileDigestB64(toBase64(u8));
    } catch (e: any) {
      setErr(e?.message || 'Failed to hash file');
    }
  }

  function pickParamsB64(): string {
    const hex = (hexInput || '').trim();
    if (hex && /^[0-9a-f]{64}$/.test(hex)) {
      const u8 = new Uint8Array(hex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));
      return toBase64(u8);
    }
    if (fileDigestB64) return fileDigestB64;
    throw new Error('Provide 64-char lowercase hex or upload params.json');
  }

  function useFakeHash() {
    try {
      const u8 = new Uint8Array(32);
      if ((globalThis as any).crypto?.getRandomValues) {
        (globalThis as any).crypto.getRandomValues(u8);
      } else {
        for (let i = 0; i < 32; i++) u8[i] = Math.floor(Math.random() * 256);
      }
      const hex = Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
      setHexInput(hex);
      setFileDigestB64(toBase64(u8));
    } catch {
      // fallback: zeros
      const u8 = new Uint8Array(32);
      setHexInput(Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join(''));
      setFileDigestB64(toBase64(u8));
    }
  }

  async function onConfirmRegister() {
    try {
      if (!activeAddress) throw new Error('Connect creator wallet');
      if (!isCreator) throw new Error('Only the creator can register');
      if (!appId) throw new Error('Missing App ID');
      const uriOk = /^[A-Za-z0-9_-]{3,40}$/.test(uri);
      if (!uriOk) throw new Error('contract_uri must match [A-Za-z0-9_-]{3,40}');
      if (!Number.isInteger(nNeeded) || nNeeded < 2 || nNeeded > 500) throw new Error('n_needed must be 2..500');
      const b64 = pickParamsB64();
      setBusy(true);
      const r = await registerExperiment({ sender: activeAddress, appId, paramsHashB64OrHex: b64, nNeeded, contractUri: uri, sign: (u)=>signTransactions(u), wait: true });
      // refresh
      await loadGlobals();
      setShowModal(false);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setBusy(false); }
  }

  const registered = (globals?.exp_registered ?? 0) === 1;
  const paramsHex = b64ToHex(globals?.params_hash_b64);
  const short = (s?: string) => (s && s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-8)}` : (s || ''));

  return (
    <div className="rounded-xl border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-md font-semibold">Experiment Status</h4>
        <span className={`text-xs px-2 py-0.5 rounded ${registered ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {registered ? 'Registered' : 'Not Registered'}
        </span>
      </div>

      {loading ? (
        <div className="text-xs text-neutral-600">Loading…</div>
      ) : (
        <div className="text-xs text-neutral-800 space-y-1">
          <div>Phase: <code>{globals?.phase ?? '-'}</code></div>
          <div>n_needed: <code>{globals?.n_needed ?? '-'}</code></div>
          <div>contract_uri: <code className="break-all">{globals?.contract_uri ?? '-'}</code></div>
          <div>exp_ts: <code>{globals?.exp_ts ? new Date((globals!.exp_ts as number) * 1000).toUTCString() : '-'}</code></div>
          <div>params_hash: <code className="break-all">{paramsHex ? short(paramsHex) : '-'}</code></div>
        </div>
      )}

      {!registered && isCreator && (
        <div className="mt-2">
          <button className="text-xs underline" onClick={()=> setShowModal(true)}>Register Experiment</button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg border shadow p-4 w-[520px] max-w-[96vw] space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Register Experiment</div>
              <button className="text-neutral-600" onClick={()=> setShowModal(false)}>x</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col">
                <span>contract_uri</span>
                <input className="border rounded px-2 py-1" value={uri} onChange={(e)=> setUri(e.target.value)} placeholder="trust_v1_sep2025" />
              </label>
              <label className="flex flex-col">
                <span>n_needed</span>
                <input type="number" min={2} max={500} step={1} className="border rounded px-2 py-1" value={nNeeded} onChange={(e)=> setNNeeded(Number(e.target.value))} />
              </label>
              <label className="flex flex-col col-span-2">
                <span>params_hash (64-hex) — optional if you upload file</span>
                <div className="flex items-center gap-2">
                  <input className="border rounded px-2 py-1 flex-1" placeholder="0123… (64 lowercase hex)" value={hexInput} onChange={(e)=> setHexInput((e.target.value || '').trim())} />
                  <button type="button" className="text-xs underline" onClick={useFakeHash} title="Fill with a random 32-byte value">Use fake</button>
                </div>
              </label>
              <label className="flex flex-col col-span-2">
                <span>or upload params.json (hashed client-side with SHA-256)</span>
                <input type="file" accept="application/json,.json" onChange={(e)=> onFileChange(e.target.files?.[0] || null)} />
                {fileDigestB64 && (
                  <div className="text-[11px] text-neutral-600">sha256: <code className="break-all">{short(b64ToHex(fileDigestB64))}</code></div>
                )}
              </label>
            </div>
            {err && <div className="text-xs text-red-600">{err}</div>}
            <div className="flex items-center justify-end gap-2">
              <button className="text-xs underline" onClick={()=> setShowModal(false)} disabled={busy}>Cancel</button>
              <button className="text-xs underline" onClick={onConfirmRegister} disabled={busy || !activeAddress || !isCreator}>{busy ? 'Submitting…' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
