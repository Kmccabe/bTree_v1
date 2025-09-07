import React, { useEffect, useMemo, useRef, useState, useContext, useCallback } from "react";
import { useWallet, PROVIDER_ID } from "@txnlab/use-wallet";
import algosdk from "algosdk";
import { Buffer } from "buffer";
import { investFlow, optInApp, setPhase } from "../chain/tx";
import { getParamsNormalized } from "../chain/params";
import { str, u64 } from "../chain/enc";
import { resolveAppId, setSelectedAppId, getSelectedAppId, clearSelectedAppId } from "../state/appId";
import { getAccountBalanceMicroAlgos } from "../chain/balance";
// QR code not used in Subject UI anymore

// ---------------------- Tiny local toast system (no deps) ----------------------
type ToastKind = "info" | "success" | "error";
type ToastAction = { label: string; href: string };
type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  actions?: ToastAction[];
  createdAt: number;
};

type ToastShowArgs = { title: string; description?: string; kind?: ToastKind; actions?: ToastAction[] };

const ToastContext = React.createContext<{
  show: (args: ToastShowArgs) => { id: string };
  remove: (id: string) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string, kind: ToastKind) => void;
  toasts: ToastItem[];
} | null>(null);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const timers = useRef<Record<string, { remaining: number; start?: number }>>({});

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timeouts.current[id];
    if (handle) {
      clearTimeout(handle);
      delete timeouts.current[id];
    }
    if (timers.current[id]) delete timers.current[id];
  }, []);

  const startTimer = useCallback((id: string, kind: ToastKind) => {
    if (kind === "error") return; // persistent until dismissed
    const meta = timers.current[id] ?? { remaining: 5500 };
    meta.start = Date.now();
    timers.current[id] = meta;
    const h = setTimeout(() => remove(id), meta.remaining);
    timeouts.current[id] = h;
  }, [remove]);

  const pauseTimer = useCallback((id: string) => {
    const handle = timeouts.current[id];
    if (handle) {
      clearTimeout(handle);
      delete timeouts.current[id];
    }
    const meta = timers.current[id];
    if (meta && meta.start) {
      const elapsed = Date.now() - meta.start;
      meta.remaining = Math.max(0, (meta.remaining ?? 0) - elapsed);
      delete meta.start;
      timers.current[id] = meta;
    }
  }, []);

  const resumeTimer = useCallback((id: string, kind: ToastKind) => {
    if (kind === "error") return; // persistent
    if (timeouts.current[id]) return; // already running
    const meta = timers.current[id];
    if (!meta) return;
    if ((meta.remaining ?? 0) <= 0) {
      remove(id);
      return;
    }
    meta.start = Date.now();
    const h = setTimeout(() => remove(id), meta.remaining);
    timeouts.current[id] = h;
  }, [remove]);

  const show = useCallback((args: ToastShowArgs) => {
    const id = Math.random().toString(36).slice(2);
    const kind: ToastKind = (args.kind as ToastKind) || "info";
    const item: ToastItem = {
      id,
      kind,
      title: args.title,
      description: args.description,
      actions: args.actions,
      createdAt: Date.now(),
    };
    setToasts((prev) => [...prev, item]);
    const ms = kind === "error" ? 0 : 5500;
    timers.current[id] = { remaining: ms };
    if (ms > 0) startTimer(id, kind);
    return { id };
  }, [remove, startTimer]);

  return (
    <ToastContext.Provider value={{ show, remove, pauseTimer, resumeTimer, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: (_args: ToastShowArgs) => ({ id: "noop" }),
      remove: (_id: string) => {},
    } as const;
  }
  return { show: ctx.show, remove: ctx.remove } as const;
}

function ToastHost() {
  const ctx = useContext(ToastContext);
  if (!ctx) return null;
  const { toasts, remove, pauseTimer, resumeTimer } = ctx;
  return (
    <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 40, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none", maxWidth: 360 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onMouseEnter={() => pauseTimer(t.id)}
          onMouseLeave={() => resumeTimer(t.id, t.kind)}
          style={{ pointerEvents: "auto", minWidth: 240 }}
          className={`rounded-md border shadow-sm px-3 py-2 text-sm bg-white ${t.kind === 'error' ? 'border-red-300' : t.kind === 'success' ? 'border-green-300' : 'border-neutral-200'}`}
        >
          <div className="flex items-start gap-2">
            <div className={`mt-1 h-2 w-2 rounded-full ${t.kind === 'error' ? 'bg-red-500' : t.kind === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
            <div className="flex-1">
              <div className="font-semibold text-neutral-800">{t.title}</div>
              {t.description && <div className="text-neutral-700 text-xs mt-0.5">{t.description}</div>}
              {Array.isArray(t.actions) && t.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {t.actions.map((a, i) => (
                    <a key={i} href={a.href} target="_blank" rel="noreferrer" className="text-xs underline text-blue-700">
                      {a.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => remove(t.id)} className="ml-2 text-neutral-500 hover:text-neutral-800" aria-label="Dismiss" title="Dismiss">
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function loraTxUrl(txId: string) {
  const net = (((import.meta as any).env?.VITE_NETWORK as string) || 'TESTNET').toUpperCase();
  const chain = net === 'MAINNET' ? 'mainnet' : 'testnet';
  return `https://lora.algokit.io/${chain}/tx/${txId}`;
}

// ---------------------- Component ----------------------
export default function SubjectActions() {
  return (
    <ToastProvider>
      <SubjectActionsInner />
    </ToastProvider>
  );
}

function SubjectActionsInner() {
  const { activeAddress, signTransactions, providers, clients } = useWallet();

  // Lightweight wallet connect/disconnect helpers (local copies for subject panels)
  const handleConnect = useCallback(async () => {
    try {
      const p = providers?.find(p => p.metadata.id === PROVIDER_ID.PERA);
      if (!p) return;
      await p.connect();
      if (!p.isActive) p.setActiveProvider();
    } catch {}
  }, [providers]);
  const handleDisconnect = useCallback(async () => {
    try { await providers?.find(p => p.metadata.id === PROVIDER_ID.PERA)?.disconnect(); } catch {}
    try { await clients?.[PROVIDER_ID.PERA]?.disconnect(); } catch {}
  }, [providers, clients]);
  function shortAddr(addr?: string | null) {
    return typeof addr === 'string' && addr.length > 12 ? `${addr.slice(0,6)}…${addr.slice(-6)}` : (addr || '');
  }
  const toast = useToast();

  // inputs
  // Leave blank by default; rely on resolveAppId() for behavior (selected or env fallback)
  const [appIdIn, setAppIdIn] = useState<string>("");
  const [unit, setUnit] = useState<number>(1000);
  const [E, setE] = useState<number>(100000); // E1 (S1 off-chain reference)
  const [E2, setE2] = useState<number>(0);    // S2 paid at Return

  // invest uses string to avoid leading-zero quirks
  const [sInput, setSInput] = useState<string>("");

  // ui state
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [funds, setFunds] = useState<{ balance?: number; checking: boolean; error?: string }>({ checking: false });
  const [pair, setPair] = useState<{ loading: boolean; error?: string | null; globals?: Record<string, any> | null; local?: { s?: number; done?: number } | null }>({ loading: false, error: null, globals: null, local: null });
  const [localDone, setLocalDone] = useState<number | undefined>(undefined);
  const [localS, setLocalS] = useState<number | undefined>(undefined);
  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const [creatorAddr, setCreatorAddr] = useState<string>("");
  type ActivityEntry = {
    id: string;
    ts: number;
    status: 'submitted' | 'confirmed' | 'rejected';
    op?: 'invest' | 'return';
    round?: number;
    txId?: string;
    appCallTxId?: string;
    paymentTxId?: string;
    reason?: string;
    rAmount?: number;
    tAmount?: number;
    s1?: string;
  };
  const [inlineStatus, setInlineStatus] = useState<{ phase: 'submitted' | 'confirmed' | 'rejected'; text: string; round?: number; txId?: string; appCallTxId?: string; paymentTxId?: string } | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  // Subject — Return form/state
  const [returnRInput, setReturnRInput] = useState<string>("");
  const [returnStatus, setReturnStatus] = useState<{ phase: 'submitted' | 'confirmed' | 'rejected'; text: string; round?: number; txId?: string } | null>(null);
  // Quick demo state
  const [demoBusy, setDemoBusy] = useState<null | 'demo' | 'return_only'>(null);
  const [demoInvestTx, setDemoInvestTx] = useState<string | null>(null);
  const [demoReturnTx, setDemoReturnTx] = useState<string | null>(null);
  // Inline phase control state (for creator convenience)
  const [phaseSelLocal, setPhaseSelLocal] = useState<number>(0);

  const APP_FUND_THRESHOLD = 200_000; // 0.20 ALGO

  // helpers
  const connected = activeAddress || "(not connected)";
  const appIdNum = Number(appIdIn);
  const appIdValid = Number.isFinite(appIdNum) && appIdNum > 0;
  const hasResolvedAppId = (() => { try { return Number.isInteger(resolveAppId()); } catch { return false; } })();
  let appAddrPreview = "";
  try {
    const idForAddr = appIdValid ? appIdNum : (() => { try { return resolveAppId(); } catch { return 0; } })();
    if (idForAddr > 0) {
      const raw = (algosdk as any).getApplicationAddress(idForAddr);
      appAddrPreview = typeof raw === "string" ? raw : raw?.toString?.();
    }
  } catch { /* ignore */ }

  // Accept ?appId= in the URL and auto-select it
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const q = sp.get('appId') || sp.get('appid') || sp.get('id');
      const n = q ? Number(q) : NaN;
      if (Number.isInteger(n) && n > 0) {
        setAppIdIn(String(n));
        setSelectedAppId(n);
      }
    } catch {}
  }, []);

  // Always-computed app account details (independent of funds state)
  const resolvedIdForAccount = useMemo(() => {
    try { return resolveAppId(); } catch { return undefined; }
  }, [appIdIn]);
  const appAccountAddr = useMemo(() => {
    if (!resolvedIdForAccount || !Number.isInteger(resolvedIdForAccount) || resolvedIdForAccount <= 0) return "";
    try {
      const raw = (algosdk as any).getApplicationAddress(resolvedIdForAccount);
      return typeof raw === "string" ? raw : raw?.toString?.();
    } catch { return ""; }
  }, [resolvedIdForAccount]);

  // Fetch app creator (via indexer) when App ID changes
  useEffect(() => {
    (async () => {
      try {
        const id = resolveAppId();
        if (!Number.isInteger(id) || id <= 0) return;
        const net = ((import.meta as any).env?.VITE_NETWORK as string | undefined)?.toUpperCase?.() || "TESTNET";
        const indexerBase = net === 'MAINNET'
          ? ((((import.meta as any).env?.VITE_MAINNET_INDEXER_URL as string) || "https://mainnet-idx.algonode.cloud"))
          : ((((import.meta as any).env?.VITE_TESTNET_INDEXER_URL as string) || "https://testnet-idx.algonode.cloud"));
        const url = `${indexerBase.replace(/\/$/, "")}/v2/applications/${id}`;
        const r = await fetch(url);
        const j = await r.json().catch(() => ({} as any));
        const cr = j?.application?.params?.creator || j?.application?.creator || j?.params?.creator || j?.creator;
        if (typeof cr === 'string' && cr.length >= 58) setCreatorAddr(cr);
      } catch {
        // ignore
      }
    })();
  }, [appIdIn, activeAddress]);

  async function loadGlobals() {
    setErr(null);
    if (!hasResolvedAppId) return setErr("Enter/select a numeric App ID (not the App Address).");
    setBusy("read");
    try {
      const id = resolveAppId();
      console.info("[appId] resolved =", id);
      console.debug("[SubjectActions] loadGlobals", { appId: id });
      const r = await fetch(`/api/pair?id=${id}`);
      const j = await r.json();
      console.debug("[SubjectActions] /api/pair", r.status, j);
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      const g = (j?.globals ?? {}) as Record<string, any>;
      setUnit(Number(g?.UNIT ?? 1000));
      // Map new globals: E1/E2 and publish into pair.globals so Return sees t and addresses
      setE(Number(g?.E1 ?? 100000));
      setE2(Number(g?.E2 ?? 0));
      setPair(prev => ({ ...prev, loading: false, error: null, globals: g, local: prev.local ?? null }));
      // Capture creator if provided by API (used for experimenter gating)
      try {
        const cr = j?.creator || j?.params?.creator || j?.application?.params?.creator;
        if (typeof cr === 'string' && cr.length >= 58) setCreatorAddr(cr);
      } catch {}

      // also refresh subject local to keep Invest gating accurate
      try {
        const { senderResolved } = resolveSender();
        const { s, done } = await fetchSubjectLocal(id, senderResolved);
        setLocalS(s);
        setLocalDone(done);
      } catch {}
    } catch (e: any) {
      console.error("[SubjectActions] loadGlobals failed", e);
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  async function checkFunds() {
    setFunds({ checking: true });
    setErr(null);
    try {
      const id = resolveAppId();
      console.info("[appId] resolved =", id);
      const addr = (algosdk as any).getApplicationAddress(id)?.toString?.() || (algosdk as any).getApplicationAddress(id);
      if (!addr || !algosdk.isValidAddress(addr)) throw new Error("Derived app address invalid");
      const balance = await getAccountBalanceMicroAlgos(addr);
      setFunds({ checking: false, balance });
    } catch (e: any) {
      console.error("[SubjectActions] checkFunds failed", e);
      setFunds({ checking: false, error: e?.message || String(e) });
    }
  }

  async function readPairStates() {
    setPair({ loading: true, error: null, globals: null, local: null });
    setErr(null);
    try {
      const id = resolveAppId();
      console.info("[appId] resolved =", id);
      // Globals via backend pair endpoint
      const pr = await fetch(`/api/pair?id=${id}`);
      const pj = await pr.json();
      console.debug("[SubjectActions] /api/pair (read states)", pr.status, pj);
      if (!pr.ok) throw new Error(pj?.error || `HTTP ${pr.status}`);
      const globals = (pj?.globals ?? {}) as Record<string, any>;
      // Keep existing globals state in sync
      if (globals) {
        if (typeof globals.UNIT === 'number') setUnit(Number(globals.UNIT));
        if (typeof globals.E1 === 'number') setE(Number(globals.E1));
        if (typeof globals.E2 === 'number') setE2(Number(globals.E2));
      }

      const { senderResolved } = resolveSender();
      const { s, done } = await fetchSubjectLocal(id, senderResolved);
      console.info('[pair/local]', senderResolved, { s, done });
      const local = { s, done };

      setPair({ loading: false, error: null, globals, local });
      setLocalS(local.s);
      setLocalDone(local.done);
    } catch (e: any) {
      console.error("[SubjectActions] readPairStates failed", e);
      setPair({ loading: false, error: e?.message || String(e), globals: null, local: null });
    }
  }

  // Refresh only the subject's local state (skip globals)
  async function refreshLocal() {
    setLocalLoading(true);
    try {
      const id = resolveAppId();
      const { senderResolved } = resolveSender();
      if (!senderResolved) return;
      const { s, done } = await fetchSubjectLocal(id, senderResolved);
      console.info('[pair/local]', senderResolved, { s, done });
      setPair(prev => ({ ...prev, local: { s, done } }));
      setLocalS(s);
      setLocalDone(done);
    } catch (e) {
      // swallow; leave previous local state
    } finally {
      setLocalLoading(false);
    }
  }

  // helper to resolve sender like investFlow
  function resolveSender(): { senderResolved: string } {
    const w: any = (globalThis as any) || {};
    const senderResolved =
      (typeof activeAddress === "string" && activeAddress) ||
      (activeAddress as any)?.address ||
      w.activeAddress ||
      (w.wallet?.accounts?.[0]?.address ?? "");
    return { senderResolved };
  }

  async function fetchSubjectLocal(appId: number, subjectAddr: string): Promise<{ s: number; done: number }> {
    const net = ((import.meta as any).env?.VITE_NETWORK as string | undefined)?.toUpperCase?.() || "TESTNET";
    const server = net === 'MAINNET'
      ? (((import.meta as any).env?.VITE_MAINNET_ALGOD_URL as string) || "https://mainnet-api.algonode.cloud")
      : (((import.meta as any).env?.VITE_TESTNET_ALGOD_URL as string) || "https://testnet-api.algonode.cloud");
    const token = net === 'MAINNET'
      ? (((import.meta as any).env?.VITE_MAINNET_ALGOD_TOKEN as string) || "")
      : (((import.meta as any).env?.VITE_TESTNET_ALGOD_TOKEN as string) || "");
    const indexerBase = net === 'MAINNET'
      ? ((((import.meta as any).env?.VITE_MAINNET_INDEXER_URL as string) || "https://mainnet-idx.algonode.cloud"))
      : ((((import.meta as any).env?.VITE_TESTNET_INDEXER_URL as string) || "https://testnet-idx.algonode.cloud"));
    const client = new (algosdk as any).Algodv2(token, server, "");
    const b64ToStr = (b64: string): string => {
      try { return Buffer.from(b64, 'base64').toString('utf8'); } catch { /* noop */ }
      try { return decodeURIComponent(escape(atob(b64))); } catch { return ""; }
    };
    const parseKv = (kvIn: any[]): { s: number; done: number } => {
      let localS = 0;
      let localDone = 0;
      for (const entry of kvIn || []) {
        const keyB64 = String(entry?.key ?? "");
        const k = b64ToStr(keyB64);
        const v = entry?.value;
        if (k === 's' && v?.type === 2) localS = Number(v?.uint ?? 0);
        if (k === 'done' && v?.type === 2) localDone = Number(v?.uint ?? 0);
      }
      return { s: localS, done: localDone };
    };

    // Primary: algod accountApplicationInformation
    try {
      const ai = await client.accountApplicationInformation(subjectAddr, appId).do();
      const kvAlgod: any[] = ai?.["app-local-state"]?.["key-value"] || ai?.["key-value"] || [];
      const parsed = parseKv(kvAlgod);
      if (parsed.s !== 0 || parsed.done !== 0 || (Array.isArray(kvAlgod) && kvAlgod.length > 0)) {
        return parsed;
      }
    } catch (e) {
      console.debug('[pair/local] algod accountApplicationInformation error', e);
    }

    // Secondary: algod accountInformation?include-all=true and scan apps-local-state
    try {
      const url = `${server.replace(/\/$/, "")}/v2/accounts/${subjectAddr}?include-all=true`;
      const headers: any = token ? { 'X-Algo-API-Token': token } : {};
      const r = await fetch(url, { headers });
      const j = await r.json();
      const apps: any[] = j?.["apps-local-state"] || j?.["applications-local-state"] || [];
      const hit = (apps || []).find((x: any) => Number(x?.id) === Number(appId));
      const kvAlgodAcct: any[] = hit?.["key-value"] || [];
      const parsedAcct = parseKv(kvAlgodAcct);
      if (parsedAcct.s !== 0 || parsedAcct.done !== 0 || (Array.isArray(kvAlgodAcct) && kvAlgodAcct.length > 0)) {
        return parsedAcct;
      }
    } catch (e) {
      console.debug('[pair/local] algod accountInformation include-all error', e);
    }

    // Fallback: indexer specific app endpoint
    try {
      const url = `${indexerBase.replace(/\/$/, "")}/v2/accounts/${subjectAddr}/applications/${appId}`;
      const r = await fetch(url);
      const j = await r.json();
      const kvIdx: any[] = j?.["app-local-state"]?.["key-value"] || j?.["application-local-state"]?.["key-value"] || [];
      const parsed = parseKv(kvIdx);
      return parsed;
    } catch (e) {
      console.debug('[pair/local] indexer fallback error', e);
      // final fallback: zeros
    }

    // Final: indexer account include-all and scan apps-local-state
    try {
      const url = `${indexerBase.replace(/\/$/, "")}/v2/accounts/${subjectAddr}?include-all=true`;
      const r = await fetch(url);
      const j = await r.json();
      const apps: any[] = j?.["apps-local-state"] || j?.["applications-local-state"] || [];
      const hit = (apps || []).find((x: any) => Number(x?.id) === Number(appId));
      const kvIdxAcct: any[] = hit?.["key-value"] || [];
      const parsedAcct = parseKv(kvIdxAcct);
      if (parsedAcct.s !== 0 || parsedAcct.done !== 0 || (Array.isArray(kvIdxAcct) && kvIdxAcct.length > 0)) {
        return parsedAcct;
      }
    } catch (e) {
      console.debug('[pair/local] indexer account include-all error', e);
    }

    return { s: 0, done: 0 };
  }

  // Eagerly seed local state whenever appId/address changes
  useEffect(() => {
    (async () => {
      try {
        const id = resolveAppId();
        const { senderResolved } = resolveSender();
        if (!senderResolved) return;
        const { s, done } = await fetchSubjectLocal(id, senderResolved);
        setLocalS(s);
        setLocalDone(done);
      } catch {}
    })();
  }, [activeAddress, appIdIn]);

  async function doOptIn() {
    setErr(null);
    if (!activeAddress) return setErr("Connect wallet as subject.");
    if (!hasResolvedAppId) return setErr("Enter/select a numeric App ID first.");
    // Validate app existence on backend before submitting Opt-In
    try {
      const id = resolveAppId();
      console.info("[appId] resolved =", id);
      console.debug("[SubjectActions] preflight opt-in /api/pair", { appId: id });
      const chk = await fetch(`/api/pair?id=${id}`);
      const cj = await chk.json().catch(() => ({} as any));
      console.debug("[SubjectActions] /api/pair preflight", chk.status, cj);
      if (!chk.ok) {
        return setErr(cj?.error || `App ${appIdNum} not found on backend network. Check network & App ID.`);
      }
    } catch (e: any) {
      return setErr(e?.message || `Failed to verify App ${appIdNum} on backend.`);
    }
    setBusy("optin");
    try {
      const id = resolveAppId();
      console.info("[appId] resolved =", id);
      console.debug("[SubjectActions] optIn submit", { sender: activeAddress, appId: id });
      await optInApp({ sender: activeAddress, appId: id, sign: (u) => signTransactions(u) });
    } catch (e: any) {
      console.error("[SubjectActions] optIn failed", e);
      setErr(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  }

  function parseLogicError(msgIn: string): { reason: string; pc?: number } {
    let raw = msgIn || "";
    // Try to extract JSON { message, pc }
    try {
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        const obj = JSON.parse(raw.slice(first, last + 1));
        if (typeof obj?.message === "string") raw = obj.message;
      }
    } catch {}
    let pc: number | undefined;
    try {
      const m = raw.match(/pc\s*=\s*(\d+)/i);
      if (m && m[1]) pc = Number(m[1]);
    } catch {}
    const lower = raw.toLowerCase();
    const friendlyRepeat = pc === 209 || (lower.includes("assert") && raw.includes("=="));
    const reason = friendlyRepeat ? "Already invested (done == 1)" : (raw.replace(/^.*?:\s*/, "").trim() || "Transaction rejected");
    return { reason, pc };
  }

  async function doInvest() {
    setErr(null);
    if (!activeAddress) return setErr("Connect wallet as subject.");
    if (!hasResolvedAppId) return setErr("Enter/select a numeric App ID (not the App Address).");

    const s = Number(sInput);
    if (!Number.isInteger(s) || s < 0) return setErr("Enter a whole number of microAlgos for s.");
    if (s % unit !== 0) return setErr(`s must be a multiple of UNIT (${unit}).`);
    if (s > E) return setErr(`s must be <= E (${E}).`);

    setBusy("invest");
    try {
      const activityId = Math.random().toString(36).slice(2);
      setInlineStatus({ phase: 'submitted', text: 'Invest submitted… (waiting for confirmation)' });
      setActivity(prev => [{ id: activityId, ts: Date.now(), status: 'submitted' as const, op: 'invest' } as ActivityEntry, ...prev].slice(0, 5));
      const id = resolveAppId();
      console.info("[appId] resolved =", id);
      console.debug("[SubjectActions] invest submit", { sender: activeAddress, appId: id, s });
      // Toast: submitted (pending)
      toast.show({ kind: 'info', title: 'Invest submitted', description: 'Pending confirmation…' });

      const r: any = await investFlow({
        sender: activeAddress,
        appId: id,
        s,
        sign: (u) => signTransactions(u),
        wait: false,
      });
      console.debug("[SubjectActions] invest result (/api/submit)", r);
      const singleTxId: string = r?.txId;
      setLastTx(singleTxId || null);

      // Capture both txids if the API returns them; otherwise fall back to single.
      const paymentTxId: string | undefined = r?.paymentTxId || r?.payTxId || r?.paymentTxID;
      const appCallTxId: string | undefined = r?.appCallTxId || r?.appTxId || r?.appCallTxID;
      setActivity(prev => prev.map(e => e.id === activityId ? { ...e, txId: singleTxId, paymentTxId, appCallTxId } : e));
      const actions = (() => {
        const arr: { label: string; href: string }[] = [];
        if (appCallTxId) arr.push({ label: 'View AppCall', href: loraTxUrl(appCallTxId) });
        if (paymentTxId) arr.push({ label: 'View Payment', href: loraTxUrl(paymentTxId) });
        if (arr.length === 0 && singleTxId) arr.push({ label: 'View on LoRA', href: loraTxUrl(singleTxId) });
        return arr;
      })();
      // Toast: submitted with links
      toast.show({ kind: 'info', title: 'Invest submitted', description: 'Awaiting on-chain confirmation…', actions });

      // Now wait for confirmation ourselves so we can toast success.
      const pendR = await fetch(`/api/pending?txid=${encodeURIComponent(singleTxId)}`);
      const pendText = await pendR.text();
      console.info('[SubjectActions] /api/pending', pendR.status, pendText);
      if (!pendR.ok) {
        const { reason, pc } = parseLogicError(pendText);
        toast.show({ kind: 'error', title: 'Invest rejected', description: reason });
        setInlineStatus({ phase: 'rejected', text: `Invest rejected: ${reason}` });
        setActivity(prev => prev.map(e => e.id === activityId ? { ...e, status: 'rejected', reason } : e));
        // No local gating in no-opt-in flow
        return;
      }
      let pend: any; try { pend = JSON.parse(pendText); } catch { pend = {}; }
      const confirmedRound: number | undefined = pend?.["confirmed-round"] ?? pend?.confirmedRound;
      const successActions = actions.length ? actions : (singleTxId ? [{ label: 'View on LoRA', href: loraTxUrl(singleTxId) }] : []);
      if (confirmedRound && Number.isFinite(confirmedRound)) {
        toast.show({ kind: 'success', title: 'Invest confirmed', description: `Round ${confirmedRound}`, actions: successActions });
        setInlineStatus({ phase: 'confirmed', text: `Invest confirmed in round ${confirmedRound}`, round: confirmedRound, txId: singleTxId, appCallTxId, paymentTxId });
        setActivity(prev => prev.map(e => e.id === activityId ? { ...e, status: 'confirmed', round: confirmedRound } : e));
      } else {
        // Fallback: pending endpoint returned 200 but no round; still mark as confirmed for UX
        toast.show({ kind: 'success', title: 'Invest confirmed', actions: successActions });
        setInlineStatus({ phase: 'confirmed', text: 'Invest confirmed', txId: singleTxId, appCallTxId, paymentTxId });
        setActivity(prev => prev.map(e => e.id === activityId ? { ...e, status: 'confirmed' } : e));
      }
      // Refresh globals so Return panel sees updated t, phase and addresses
      try { await loadGlobals(); } catch {}
    } catch (e: any) {
      console.error("[SubjectActions] invest failed", e);
      const msg = e?.message || String(e);
      const { reason, pc } = parseLogicError(msg);
      toast.show({ kind: 'error', title: 'Invest rejected', description: reason });
      setInlineStatus({ phase: 'rejected', text: `Invest rejected: ${reason}` });
      setActivity(prev => {
        const copy: ActivityEntry[] = [...prev];
        const idx = copy.findIndex(x => x.status === 'submitted');
        if (idx >= 0) copy[idx] = { ...copy[idx], status: 'rejected', reason };
        else copy.unshift({ id: Math.random().toString(36).slice(2), ts: Date.now(), status: 'rejected', reason } as ActivityEntry);
        return copy.slice(0, 5);
      });
      // No local gating in no-opt-in flow
      setErr(msg);
    } finally {
      setBusy(null);
    }
  }

  const alreadyInvested = false; // no local gating in no-opt-in flow
  const investDisabled =
    !!busy || !activeAddress || !hasResolvedAppId ||
    alreadyInvested ||
    (typeof funds.balance === 'number' && funds.balance < APP_FUND_THRESHOLD) ||
    !/^\d+$/.test(sInput || "0") ||
    Number(sInput) % unit !== 0 ||
    Number(sInput) > E ||
    (inlineStatus?.phase === 'confirmed');

  // ----- Return flow -----
  const globalsTVal: number = (() => { const g: any = pair.globals as any; const v = g && typeof g.t === 'number' ? Number(g.t) : 0; return Number.isFinite(v) ? v : 0; })();
  const globalsRet: number = (() => { const g: any = pair.globals as any; const v = g && typeof g.ret === 'number' ? Number(g.ret) : 0; return Number.isFinite(v) ? v : 0; })();
  const rNum = Number(returnRInput || "0");
  const rValid = Number.isInteger(rNum) && rNum >= 0 && rNum <= globalsTVal;
  const hasFundsInfo = typeof funds.balance === 'number';
  const underfundedForReturn = globalsTVal > 0 && hasFundsInfo && (funds.balance as number) < (globalsTVal + (E2 || 0));
  const s1FromGlobals: string = (() => {
    const g:any = pair.globals as any;
    const raw = g?.s1_addr || g?.s1;
    if (!raw) return '';
    if (typeof raw === 'string') {
      try { if ((algosdk as any).isValidAddress && (algosdk as any).isValidAddress(raw)) return raw; } catch {}
      try {
        const bytes = Buffer.from(raw, 'base64');
        if (bytes && bytes.length === 32) { try { return (algosdk as any).encodeAddress(bytes); } catch {} }
      } catch {}
    }
    if (raw && typeof raw.bytes === 'string') {
      try {
        const bytes = Buffer.from(raw.bytes, 'base64');
        if (bytes && bytes.length === 32) { try { return (algosdk as any).encodeAddress(bytes); } catch {} }
      } catch {}
    }
    return '';
  })();
  const s2FromGlobals: string = (() => {
    const g:any = pair.globals as any;
    const raw = g?.s2_addr || g?.s2;
    try {
      if (typeof raw === 'string') {
        const b = Buffer.from(raw, 'base64'); if (b.length === 32) return (algosdk as any).encodeAddress(b);
        if ((algosdk as any).isValidAddress?.(raw)) return raw;
      } else if (raw && typeof raw.bytes === 'string') {
        const b = Buffer.from(raw.bytes, 'base64'); if (b.length === 32) return (algosdk as any).encodeAddress(b);
      }
    } catch {}
    return '';
  })();
  const s1Valid = !!s1FromGlobals && ((algosdk as any).isValidAddress ? (algosdk as any).isValidAddress(s1FromGlobals) : (s1FromGlobals.length === 58));
  const returnDisabled = !!busy || !activeAddress || !hasResolvedAppId || globalsTVal <= 0 || globalsRet === 1 || !rValid || underfundedForReturn || !s1Valid;
  const returnBlockers = useMemo(() => {
    const msgs: string[] = [];
    if (!hasResolvedAppId) msgs.push('App ID not set');
    if (!activeAddress) msgs.push('Connect wallet');
    if (!(globalsTVal > 0)) msgs.push('t == 0');
    if (globalsRet === 1) msgs.push('Already returned');
    if (!rValid) msgs.push(`Enter r between 0 and ${globalsTVal || 0}`);
    if (!s1Valid) msgs.push('S1 not found (Read pair states after Invest)');
    if (hasFundsInfo && underfundedForReturn) msgs.push(`Underfunded (needs >= ${(globalsTVal + (E2||0)).toLocaleString()} microAlgos)`);
    if (busy) msgs.push('Busy');
    return msgs;
  }, [hasResolvedAppId, activeAddress, globalsTVal, globalsRet, rValid, s1Valid, hasFundsInfo, underfundedForReturn, busy]);

  async function doReturn() {
    setErr(null);
    if (!activeAddress) return setErr("Connect wallet as subject.");
    if (!hasResolvedAppId) return setErr("Enter/select a numeric App ID.");
    const t = globalsTVal;
    if (!(t > 0)) return setErr("Nothing available to return (t == 0).");
    const r = Number(returnRInput || "0");
    if (!Number.isInteger(r) || r < 0 || r > t) return setErr(`Enter r in range 0..${t}.`);
    const s1 = s1FromGlobals;
    if (!s1Valid) return setErr('Missing S1 (investor) address in globals. Read Pair States or try again.');
    if (hasFundsInfo && underfundedForReturn) return setErr("App underfunded; check funds.");

    setBusy('return');
    try {
      const id = resolveAppId();
      const { senderResolved } = resolveSender();
      // Toast + status
      setReturnStatus({ phase: 'submitted', text: 'Return submitted… (waiting for confirmation)' });
      const activityId = Math.random().toString(36).slice(2);
      setActivity(prev => [{ id: activityId, ts: Date.now(), status: 'submitted' as const, op: 'return', rAmount: r, tAmount: t } as ActivityEntry, ...prev].slice(0, 5));
      toast.show({ kind: 'info', title: 'Return submitted', description: 'Pending confirmation…' });

      const sp: any = await getParamsNormalized();
      const mf = (sp as any).minFee ?? (sp as any).fee ?? 1000;
      // Provide relevant accounts explicitly for compatibility with older TEAL
      // variants that reference txna Accounts for S1/S2 during Return.
      const accounts: string[] = [];
      if (s1 && (algosdk as any).isValidAddress?.(s1)) accounts.push(s1);
      if (senderResolved && (!accounts.length || accounts[0] !== senderResolved)) accounts.push(senderResolved);
      const call: any = (algosdk as any).makeApplicationNoOpTxnFromObject({
        sender: senderResolved,
        appIndex: id,
        appArgs: [str('return'), u64(r)],
        accounts,
        // Two inner payments → use higher flat fee
        suggestedParams: { ...(sp as any), flatFee: true, fee: mf * 4 },
      });
      const stxns = await signTransactions([(algosdk as any).encodeUnsignedTransaction(call)]);
      const payload = { stxns: stxns.map((b: Uint8Array) => Buffer.from(b).toString('base64')) };
      const sub = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const subText = await sub.text();
      if (!sub.ok) throw new Error(`Return submit ${sub.status}: ${subText}`);
      let sj: any; try { sj = JSON.parse(subText); } catch { sj = {}; }
      const txId: string = sj?.txId || sj?.txid || sj?.txID;
      if (!txId) throw new Error('Missing txId');
      // attach txId to activity for LoRA link rendering
      setActivity(prev => prev.map(e => e.id === activityId ? { ...e, txId } : e));

      const pendR = await fetch(`/api/pending?txid=${encodeURIComponent(txId)}`);
      const pendText = await pendR.text();
      if (!pendR.ok) {
        const { reason } = parseLogicError(pendText);
        toast.show({ kind: 'error', title: 'Return rejected', description: reason });
        setReturnStatus({ phase: 'rejected', text: `Return rejected: ${reason}` });
        setActivity(prev => prev.map(e => e.id === activityId ? { ...e, status: 'rejected', reason } : e));
        return;
      }
      let pend: any; try { pend = JSON.parse(pendText); } catch { pend = {}; }
      const confirmedRound: number | undefined = pend?.['confirmed-round'] ?? pend?.confirmedRound;
      // Success
      toast.show({ kind: 'success', title: 'Return confirmed', description: confirmedRound ? `Round ${confirmedRound}` : undefined, actions: txId ? [{ label: 'View on LoRA', href: loraTxUrl(txId) }] : undefined });
      setReturnStatus({ phase: 'confirmed', text: confirmedRound ? `Return confirmed in round ${confirmedRound}` : 'Return confirmed', round: confirmedRound, txId });
      setActivity(prev => prev.map(e => e.id === activityId ? { ...e, status: 'confirmed', round: confirmedRound } : e));
      // reflect ret=1 immediately
      setPair(prev => ({ ...prev, globals: { ...(prev.globals ?? {}), ret: 1 } } as any));
    } catch (e: any) {
      console.error('[SubjectActions] return failed', e);
      const msg = e?.message || String(e);
      const { reason } = parseLogicError(msg);
      toast.show({ kind: 'error', title: 'Return rejected', description: reason });
      setReturnStatus({ phase: 'rejected', text: `Return rejected: ${reason}` });
      setErr(msg);
    } finally {
      setBusy(null);
    }
  }

  // ---------- Quick Demo helpers ----------
  async function getAppBalance(): Promise<number> {
    const id = resolveAppId();
    const addr = (algosdk as any).getApplicationAddress(id)?.toString?.() || (algosdk as any).getApplicationAddress(id);
    if (!addr || !(algosdk as any).isValidAddress?.(addr)) throw new Error("Derived app address invalid");
    return await getAccountBalanceMicroAlgos(addr);
  }

  async function runDemo() {
    setErr(null);
    if (!activeAddress) return setErr("Connect wallet as subject.");
    if (!hasResolvedAppId) return setErr("Enter/select a numeric App ID.");
    const s = Number(sInput);
    if (!Number.isInteger(s) || s < 0) return setErr("Enter a whole number of microAlgos for s.");
    if (s % unit !== 0) return setErr(`s must be a multiple of UNIT (${unit}).`);
    if (s > E) return setErr(`s must be <= E (${E}).`);

    setDemoBusy('demo');
    setDemoInvestTx(null);
    setDemoReturnTx(null);
    try {
      const id = resolveAppId();
      const { senderResolved } = resolveSender();

      // 1) Phase 2 if creator
      try {
        const creator = (pair.globals as any)?.creator || creatorAddr;
        if (creator && senderResolved === creator) {
          toast.show({ kind: 'info', title: 'Setting phase', description: 'Attempting phase=2…' });
          await setPhase({ sender: senderResolved, appId: id, phase: 2, sign: (u)=>signTransactions(u), wait: true });
        }
      } catch {}

      // 2) Opt-In (ignore if already opted in)
      try {
        await optInApp({ sender: senderResolved, appId: id, sign: (u)=>signTransactions(u), wait: true as any });
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (!/already opted in/i.test(msg)) {
          // surface other opt-in errors
          throw e;
        }
      }

      // 3) Invest
      toast.show({ kind: 'info', title: 'Invest submitted', description: 'Pending confirmation…' });
      const inv = await investFlow({ sender: senderResolved, appId: id, s, sign: (u)=>signTransactions(u), wait: true });
      if (inv?.txId) setDemoInvestTx(inv.txId);

      // 4) Read states to get t
      await readPairStates();

      // 5) Ensure app funded for Return
      const g:any = pair.globals as any;
      const tNow = Number((g && typeof g.t === 'number') ? g.t : 0);
      const bal = await getAppBalance();
      if (tNow > 0 && bal < tNow) {
        toast.show({ kind: 'error', title: 'Underfunded for Return', description: `Needs >= ${tNow.toLocaleString()} microAlgos` });
        return;
      }

      // 6) Return using current r input
      await runReturnOnly();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setDemoBusy(null);
    }
  }

  async function runReturnOnly() {
    setErr(null);
    if (!activeAddress) return setErr("Connect wallet as subject.");
    if (!hasResolvedAppId) return setErr("Enter/select a numeric App ID.");
    const r = Number(returnRInput || "0");
    if (!Number.isInteger(r) || r < 0) return setErr("Enter r as a whole number of microAlgos.");

    setDemoBusy('return_only');
    try {
      const id = resolveAppId();
      const { senderResolved } = resolveSender();
      const sp: any = await getParamsNormalized();
      const mf = (sp as any).minFee ?? (sp as any).fee ?? 1000;
      const s1 = s1FromGlobals;
      const accounts: string[] = [];
      if (s1 && (algosdk as any).isValidAddress?.(s1)) accounts.push(s1);
      if (senderResolved && (!accounts.length || accounts[0] !== senderResolved)) accounts.push(senderResolved);
      const call: any = (algosdk as any).makeApplicationNoOpTxnFromObject({
        sender: senderResolved,
        appIndex: id,
        appArgs: [str('return'), u64(r)],
        accounts,
        suggestedParams: { ...(sp as any), flatFee: true, fee: mf * 4 },
      });
      const stxns = await signTransactions([(algosdk as any).encodeUnsignedTransaction(call)]);
      const payload = { stxns: stxns.map((b: Uint8Array) => Buffer.from(b).toString('base64')) };
      const sub = await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const subText = await sub.text();
      if (!sub.ok) throw new Error(`Return submit ${sub.status}: ${subText}`);
      let sj: any; try { sj = JSON.parse(subText); } catch { sj = {}; }
      const txId: string = sj?.txId || sj?.txid || sj?.txID;
      if (txId) setDemoReturnTx(txId);
      const pendR = await fetch(`/api/pending?txid=${encodeURIComponent(txId)}`);
      if (!pendR.ok) throw new Error(await pendR.text());
      toast.show({ kind: 'success', title: 'Return confirmed', actions: txId ? [{ label: 'View on LoRA', href: loraTxUrl(txId) }] : undefined });
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setDemoBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border p-4 space-y-3" style={{ position: "relative" }}>
      {/* Activity first */}
      {activity.length > 0 && (
        <div className="text-xs text-neutral-700">
          <div className="font-semibold">Activity</div>
          <ul className="mt-1">
            {activity.slice(0, 5).map((e) => {
              const isReturn = e.op === 'return';
              const tStr = typeof e.tAmount === 'number' ? e.tAmount.toLocaleString() : undefined;
              const rStr = typeof e.rAmount === 'number' ? e.rAmount.toLocaleString() : undefined;
              const remStr = (typeof e.tAmount === 'number' && typeof e.rAmount === 'number') ? Math.max(0, e.tAmount - e.rAmount).toLocaleString() : undefined;
              return (
                <li key={e.id} className="mt-1">
                  <span className="text-neutral-500">{new Date(e.ts).toLocaleTimeString()}</span>
                  {' '}
                  {e.status === 'submitted' && (
                    isReturn ? (
                      <span>Return submitted…{(rStr && tStr) ? ` (r: ${rStr}, t: ${tStr})` : ''}</span>
                    ) : (
                      <span>Invest submitted…</span>
                    )
                  )}
                  {e.status === 'confirmed' && (
                    isReturn ? (
                      <span className="text-green-700">Return confirmed in round {e.round}{(rStr && remStr) ? ` - S1 gets ${rStr}, S2 gets ${remStr}` : ''}</span>
                    ) : (
                      <span className="text-green-700">Invest confirmed in round {e.round}</span>
                    )
                  )}
                  {e.status === 'rejected' && (
                    isReturn ? (
                      <span className="text-red-600">Return rejected{e.reason ? `: ${e.reason}` : ''}</span>
                    ) : (
                      <span className="text-red-600">Invest rejected{e.reason ? `: ${e.reason}` : ''}</span>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <h3 className="text-lg font-semibold">Subject 1's Decision</h3>
      <div className="flex items-center gap-2 text-xs text-neutral-700">
        <span>Connect Subject 1:</span>
        {!activeAddress ? (
          <button className="text-xs underline" onClick={handleConnect}>Connect wallet</button>
        ) : (
          <>
            <span><code>{shortAddr(activeAddress)}</code></span>
            <button className="text-xs underline" onClick={handleDisconnect}>Disconnect</button>
          </>
        )}
      </div>

      {/* App ID (resolved) + read */}
      <div className="flex items-center gap-2 text-sm">
        <span>App ID:</span>
        <code>{(() => { try { return resolveAppId(); } catch { return '(unset)'; } })()}</code>
        <button className="text-xs underline" onClick={loadGlobals} disabled={!!busy || !hasResolvedAppId}>Load globals</button>
      </div>

      {/* Inline status */}
      {inlineStatus && (
        <div className="text-xs">
          {inlineStatus.phase === 'submitted' && (
            <span className="text-neutral-700">Invest submitted… (waiting for confirmation)</span>
          )}
          {inlineStatus.phase === 'confirmed' && (
            <span className="text-green-700">
              Invest confirmed in round {inlineStatus.round}
              {' '}
              {(() => {
                const links: { label: string; href: string }[] = [];
                if (inlineStatus.appCallTxId) links.push({ label: 'View AppCall', href: loraTxUrl(inlineStatus.appCallTxId) });
                if (inlineStatus.paymentTxId) links.push({ label: 'View Payment', href: loraTxUrl(inlineStatus.paymentTxId) });
                if (links.length === 0 && inlineStatus.txId) links.push({ label: 'View on LoRA', href: loraTxUrl(inlineStatus.txId) });
                return links.length ? (
                  <>
                    · {links.map((l, i) => (
                      <a key={i} href={l.href} target="_blank" rel="noreferrer" className="underline text-blue-700">{l.label}</a>
                    )).reduce((acc, el, i) => acc.length ? [...acc, <span key={`sep-${i}`}> · </span>, el] : [el], [] as any)}
                  </>
                ) : null;
              })()}
            </span>
          )}
          {inlineStatus.phase === 'rejected' && (
            <span className="text-red-600">{inlineStatus.text}</span>
          )}
          {/* No action button here; see dedicated button below Invest line */}
        </div>
      )}

      {/* Activity block moved above */}

      {/* App account QR/section removed */}

      {/* Connected + derived app address (removed for cleaner UI) */}

      {/* Funds status (QR removed) */}
      {(typeof funds.balance === 'number' || funds.error) && (
        <div className="text-xs text-neutral-700">
          {typeof funds.balance === 'number' ? (
            (()=>{
              const ok = funds.balance >= APP_FUND_THRESHOLD;
              const algo = (funds.balance / 1_000_000).toFixed(6);
              const tVal = (() => { const g:any = pair.globals as any; return (g && typeof g.t === 'number') ? Number(g.t) : 0; })();
              const needsFunding = tVal > 0 && (funds.balance ?? 0) < tVal;
              return (
                <div>
                  App balance: {ok ? <span className="text-green-600">OK ({'>'}= 0.20 ALGO)</span> : <span className="text-amber-600">Low (needs {'>'}= 0.20 ALGO)</span>} · {algo} ALGO
                  {needsFunding && (
                    <div className="mt-1 text-amber-700">
                      App underfunded. Needs {'>'}= {tVal.toLocaleString()} microAlgos before Subject 2 can return. Use the QR below to fund.
                    </div>
                  )}
                  {/* QR and address block removed for simplicity */}
                </div>
              );
            })()
          ) : (
            <span className="text-red-600">{funds.error}</span>
          )}
        </div>
      )}

      {/* Pair state / Globals panel removed */}

      {/* s input + invest */}
      <div className="flex items-center gap-2 text-sm">
        <span>Invest s (microAlgos):</span>
        <input
          inputMode="numeric"
          pattern="\d*"
          className="border rounded px-2 py-1 w-44"
          value={sInput}
          onChange={(e) => setSInput(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={`multiple of ${unit}, <= ${E}`}
        />
        <button className="text-xs underline" 
          onClick={doInvest}
          disabled={investDisabled}>
          {busy==="invest" ? "Investing…" : "Invest"}
        </button>
        {(typeof funds.balance === 'number' && funds.balance < APP_FUND_THRESHOLD) && (
          <span className="text-xs text-amber-600">App balance low; needs {'>'}= 0.20 ALGO</span>
        )}
      </div>

      {/* Invest Done button placed directly below Invest controls */}
      {inlineStatus?.phase === 'confirmed' && (
        <div>
          {(() => {
            const creatorGlobal = (pair.globals as any)?.creator || creatorAddr;
            const isCreatorWallet = !!activeAddress && !!creatorGlobal && activeAddress === creatorGlobal;
            const disabled = !!busy || !activeAddress; // allow click for non-creator, show toast
            const title = !activeAddress ? 'Connect wallet' : '';
            return (
              <button
                className="rounded px-2 py-1 border"
                disabled={disabled}
                title={title}
                onClick={async () => {
                  try {
                    const id = resolveAppId();
                    if (!isCreatorWallet) {
                      toast.show({ kind: 'error', title: 'Experimenter only', description: 'Connect the experimenter wallet to advance to Return.' });
                      return;
                    }
                    const r = await setPhase({ sender: activeAddress!, appId: id, phase: 3, sign: (u)=>signTransactions(u), wait: true });
                    const actions = r?.txId ? [{ label: 'View on LoRA', href: loraTxUrl(r.txId) }] : undefined;
                    toast.show({ kind: 'success', title: 'Phase set to 3 (Return)', description: r?.confirmedRound ? `Round ${r.confirmedRound}` : undefined, actions });
                    await loadGlobals();
                    // Disconnect Subject 1 wallet after Invest Done
                    try { await handleDisconnect(); } catch {}
                  } catch(e:any) { setErr(e?.message || String(e)); }
                }}
              >
                Invest Done
              </button>
            );
          })()}
        </div>
      )}

      {/* Subject - Return */}
      <div className="mt-4 rounded-xl border p-3 space-y-2">
        <h4 className="text-md font-semibold">Subject 2's Decision</h4>
        <div className="flex items-center gap-2 text-xs text-neutral-700">
          <span>Connect Subject 2:</span>
          {!activeAddress ? (
            <button className="text-xs underline" onClick={handleConnect}>Connect wallet</button>
          ) : (
            <>
              <span><code>{shortAddr(activeAddress)}</code></span>
              <button className="text-xs underline" onClick={handleDisconnect}>Disconnect</button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-700">
          <span>App ID:</span>
          <code>{(() => { try { return resolveAppId(); } catch { return '(unset)'; } })()}</code>
          <button className="text-xs underline" onClick={loadGlobals} disabled={!!busy || !hasResolvedAppId}>Load globals</button>
        </div>
        {/* Available/Constants lines removed for simpler UI */}
        {!s1Valid && (
          <div className="text-xs text-amber-700">S1 (investor) not found yet. Ensure Invest confirmed and click Load globals.</div>
        )}
        {/* Removed S2 mismatch warning for simplified flow */}
        {/* No S1 input needed; contract tracks S1 globally */}
        <div className="flex items-center gap-2 text-sm">
          <span>r (microAlgos):</span>
          <input
            inputMode="numeric"
            pattern="\\d*"
            className="border rounded px-2 py-1 w-44"
            value={returnRInput}
            onChange={(e)=> setReturnRInput(e.target.value.replace(/[^\d]/g, ''))}
            placeholder={`0 <= r <= ${globalsTVal || 0}`}
          />
          <button className="text-xs underline" onClick={doReturn} disabled={returnDisabled}>
            {busy === 'return' ? 'Returning…' : 'Return'}
          </button>
        </div>
        {(returnStatus?.phase === 'submitted' || returnStatus?.phase === 'confirmed') && (
          <div className="mt-2">
            <button
              className="rounded px-2 py-1 border"
              onClick={async () => { try { await handleDisconnect(); } catch {} }}
            >
              Return Done
            </button>
          </div>
        )}
        {/* Hide verbose blockers; keep UI simple */}
        {globalsTVal <= 0 && <div className="text-xs text-amber-700">Nothing available to return (t == 0).</div>}
        {(!rValid && globalsTVal > 0) && <div className="text-xs text-amber-700">Enter r between 0 and {globalsTVal}.</div>}
        {underfundedForReturn && <div className="text-xs text-amber-700">Underfunded: needs {'>'}= {(globalsTVal + (E2||0)).toLocaleString()} microAlgos in app.</div>}
        {returnStatus && (
          <div className="text-xs">
            {returnStatus.phase === 'submitted' && <span className="text-neutral-700">Return submitted… (waiting for confirmation)</span>}
            {returnStatus.phase === 'confirmed' && <span className="text-green-700">{returnStatus.text}</span>}
            {returnStatus.phase === 'rejected' && <span className="text-red-600">{returnStatus.text}</span>}
          </div>
        )}
      </div>

      {/* Removed TxID line for a cleaner UI */}
      {err && <div className="text-sm text-red-600">{err}</div>}
      <p className="text-xs text-neutral-500">
        Invest: phase 1 or 0 (when both subjects set), 2-txn group, s multiple of UNIT, 0 {'<='} s {'<='} E1. Return: phase 2, r multiple of UNIT, balance {'>='} t + E2.
      </p>

      {/* Quick Demo (single account) */}
      <div className="mt-6 rounded-xl border p-3 space-y-2">
        <h4 className="text-md font-semibold">Quick Demo (single account)</h4>
        <div className="text-xs text-neutral-700">Runs: [Phase 2 if experimenter] → Invest → Return</div>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <label className="flex items-center gap-2">
            <span>s (microAlgos)</span>
            <input inputMode="numeric" pattern="\\d*" className="border rounded px-2 py-1 w-36" value={sInput}
              onChange={(e)=> setSInput(e.target.value.replace(/[^\d]/g, ''))} placeholder={`multiple of ${unit}`} />
          </label>
          <label className="flex items-center gap-2">
            <span>r (microAlgos)</span>
            <input inputMode="numeric" pattern="\\d*" className="border rounded px-2 py-1 w-36" value={returnRInput}
              onChange={(e)=> setReturnRInput(e.target.value.replace(/[^\d]/g, ''))} placeholder={`0..${globalsTVal || 0}`} />
          </label>
          <button className="text-xs underline" onClick={runDemo}
            disabled={!!busy || !!demoBusy || !activeAddress || !hasResolvedAppId || !/^\d+$/.test(sInput || '0') || (Number(sInput) % unit !== 0) || (Number(sInput) > E)}>
            {demoBusy === 'demo' ? 'Running…' : 'Run Demo'}
          </button>
          <button className="text-xs underline" onClick={runReturnOnly}
            disabled={!!busy || !!demoBusy || !activeAddress || !hasResolvedAppId || !(globalsTVal > 0) || globalsRet === 1 || !rValid || underfundedForReturn}>
            {demoBusy === 'return_only' ? 'Returning…' : 'Run Return only'}
          </button>
        </div>
        {(demoInvestTx || demoReturnTx) && (
          <div className="text-xs text-neutral-700">
            {demoInvestTx && (<span>Invest: <a className="underline" href={loraTxUrl(demoInvestTx)} target="_blank" rel="noreferrer">View on LoRA</a></span>)}
            {demoInvestTx && demoReturnTx && <span> · </span>}
            {demoReturnTx && (<span>Return: <a className="underline" href={loraTxUrl(demoReturnTx)} target="_blank" rel="noreferrer">View on LoRA</a></span>)}
          </div>
        )}
      </div>

      <ToastHost />
    </div>
  );
}
