import React, { useEffect, useMemo, useRef, useState, useContext, useCallback } from "react";
import { useWallet } from "@txnlab/use-wallet";
import algosdk from "algosdk";
import { Buffer } from "buffer";
import { investFlow, optInApp } from "../chain/tx";
import { resolveAppId, setSelectedAppId, getSelectedAppId, clearSelectedAppId } from "../state/appId";
import { getAccountBalanceMicroAlgos } from "../chain/balance";
import { QRCodeCanvas } from "qrcode.react";

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
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function loraTxUrl(txId: string) { return `https://lora.algorand.foundation/tx/${txId}?network=testnet`; }

// ---------------------- Component ----------------------
export default function SubjectActions() {
  return (
    <ToastProvider>
      <SubjectActionsInner />
    </ToastProvider>
  );
}

function SubjectActionsInner() {
  const { activeAddress, signTransactions } = useWallet();
  const toast = useToast();

  // inputs
  // Leave blank by default; rely on resolveAppId() for behavior (selected or env fallback)
  const [appIdIn, setAppIdIn] = useState<string>("");
  const [unit, setUnit] = useState<number>(1000);
  const [E, setE] = useState<number>(100000);

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
  type ActivityEntry = {
    id: string;
    ts: number;
    status: 'submitted' | 'confirmed' | 'rejected';
    round?: number;
    txId?: string;
    appCallTxId?: string;
    paymentTxId?: string;
    reason?: string;
  };
  const [inlineStatus, setInlineStatus] = useState<{ phase: 'submitted' | 'confirmed' | 'rejected'; text: string; round?: number; txId?: string; appCallTxId?: string; paymentTxId?: string } | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

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
      setUnit(Number(j?.globals?.UNIT ?? 1000));
      setE(Number(j?.globals?.E ?? 100000));

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
        if (typeof globals.E === 'number') setE(Number(globals.E));
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
    if (!Number.isInteger(s) || s < 0) return setErr("Enter a whole number of µAlgos for s.");
    if (s % unit !== 0) return setErr(`s must be a multiple of UNIT (${unit}).`);
    if (s > E) return setErr(`s must be ≤ E (${E}).`);

    setBusy("invest");
    try {
      const activityId = Math.random().toString(36).slice(2);
      setInlineStatus({ phase: 'submitted', text: 'Invest submitted… (waiting for confirmation)' });
      setActivity(prev => [{ id: activityId, ts: Date.now(), status: 'submitted' as const } as ActivityEntry, ...prev].slice(0, 5));
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
        // If it's the known repeat-invest gate, set done=1 locally to keep button disabled
        if (pc === 209 || /Already invested/.test(reason)) {
          setPair(prev => ({ ...prev, local: { ...(prev.local ?? {}), done: 1 } }));
          setLocalDone(1);
        }
        return;
      }
      let pend: any; try { pend = JSON.parse(pendText); } catch { pend = {}; }
      const confirmedRound: number | undefined = pend?.["confirmed-round"] ?? pend?.confirmedRound;
      if (confirmedRound && Number.isFinite(confirmedRound)) {
        const successActions = actions.length ? actions : (singleTxId ? [{ label: 'View on LoRA', href: loraTxUrl(singleTxId) }] : []);
        toast.show({ kind: 'success', title: 'Invest confirmed', description: `Round ${confirmedRound}`, actions: successActions });
        setInlineStatus({ phase: 'confirmed', text: `Invest confirmed in round ${confirmedRound}`, round: confirmedRound, txId: singleTxId, appCallTxId, paymentTxId });
        setActivity(prev => prev.map(e => e.id === activityId ? { ...e, status: 'confirmed', round: confirmedRound } : e));
        // Immediately reflect local state so the Invest button disables without manual refresh
        setPair(prev => ({ ...prev, local: { s, done: 1 } }));
        setLocalS(s);
        setLocalDone(1);
      }
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
      if (pc === 209 || /Already invested/.test(reason)) {
        setPair(prev => ({ ...prev, local: { ...(prev.local ?? {}), done: 1 } }));
        setLocalDone(1);
      }
      setErr(msg);
    } finally {
      setBusy(null);
    }
  }

  const alreadyInvested = localDone === 1;
  const investDisabled =
    !!busy || !activeAddress || !hasResolvedAppId ||
    alreadyInvested ||
    (typeof funds.balance === 'number' && funds.balance < APP_FUND_THRESHOLD) ||
    !/^\d+$/.test(sInput || "0") ||
    Number(sInput) % unit !== 0 ||
    Number(sInput) > E;

  return (
    <div className="rounded-2xl border p-4 space-y-3" style={{ position: "relative" }}>
      <h3 className="text-lg font-semibold">Subject — Invest</h3>

      {/* App ID + read */}
      <div className="flex items-center gap-2 text-sm">
        <span>App ID:</span>
        <input
          type="number"
          className="border rounded px-2 py-1 w-44"
          value={appIdIn}
          onChange={(e)=>{
            const v = e.target.value;
            setAppIdIn(v);
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) setSelectedAppId(n);
            else clearSelectedAppId();
          }}
          placeholder="e.g., 745000000"
        />
        <button className="text-xs underline" onClick={loadGlobals} disabled={!!busy || !hasResolvedAppId}>
          Load globals
        </button>
        <button className="text-xs underline" onClick={doOptIn} disabled={!!busy || !activeAddress || !hasResolvedAppId}>
          {busy === "optin" ? "Opting in…" : "Opt-In"}
        </button>
        <button className="text-xs underline" onClick={checkFunds} disabled={!!busy || !hasResolvedAppId || funds.checking}>
          {funds.checking ? "Checking…" : "Check funds"}
        </button>
        <button className="text-xs underline" onClick={readPairStates} disabled={pair.loading || !hasResolvedAppId}>
          {pair.loading ? "Reading…" : "Read pair states"}
        </button>
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
        </div>
      )}

      {/* Activity log (last 3-5) */}
      {activity.length > 0 && (
        <div className="text-xs text-neutral-700">
          <div className="font-semibold">Activity</div>
          <ul className="mt-1">
            {activity.slice(0, 5).map((e) => (
              <li key={e.id} className="mt-1">
                <span className="text-neutral-500">{new Date(e.ts).toLocaleTimeString()}</span>
                {' '}
                {e.status === 'submitted' && <span>Invest submitted…</span>}
                {e.status === 'confirmed' && <span className="text-green-700">Invest confirmed in round {e.round}</span>}
                {e.status === 'rejected' && <span className="text-red-600">Invest rejected{e.reason ? `: ${e.reason}` : ''}</span>}
                {' '}
                {(() => {
                  const links: { label: string; href: string }[] = [];
                  if (e.appCallTxId) links.push({ label: 'AppCall', href: loraTxUrl(e.appCallTxId) });
                  if (e.paymentTxId) links.push({ label: 'Payment', href: loraTxUrl(e.paymentTxId) });
                  if (links.length === 0 && e.txId) links.push({ label: 'View', href: loraTxUrl(e.txId) });
                  return links.length ? (
                    <>
                      {links.map((l, i) => (
                        <a key={i} href={l.href} target="_blank" rel="noreferrer" className="underline text-blue-700 ml-1">{l.label}</a>
                      ))}
                    </>
                  ) : null;
                })()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* App account (always visible when resolvable) */}
      {appAccountAddr && (
        <div className="text-xs text-neutral-700">
          <div className="font-semibold mb-1">App account</div>
          <div className="flex items-center gap-2">
            <code className="break-all">{appAccountAddr}</code>
            <button className="text-xs underline" onClick={() => navigator.clipboard.writeText(appAccountAddr)}>Copy</button>
            <a className="text-xs underline" href={`https://lora.algokit.io/testnet/account/${appAccountAddr}`} target="_blank" rel="noreferrer">Open in LoRA (TestNet)</a>
          </div>
          <div className="mt-2">
            <QRCodeCanvas value={appAccountAddr} size={128} />
          </div>
        </div>
      )}

      {/* Connected + derived app address */}
      <div className="text-xs text-neutral-600">
        Connected: <code>{connected}</code>
        {appAddrPreview && <> · App Address: <code>{appAddrPreview}</code></>}
        <span className="ml-2">UNIT: {unit} · E: {E}</span>
      </div>

      {/* Funds status */}
      {(typeof funds.balance === 'number' || funds.error) && (
        <div className="text-xs text-neutral-700">
          {typeof funds.balance === 'number' ? (
            (()=>{
              const ok = funds.balance >= APP_FUND_THRESHOLD;
              const algo = (funds.balance / 1_000_000).toFixed(6);
              return (
                <div>
                  App balance: {ok ? <span className="text-green-600">OK (≥ 0.20 ALGO)</span> : <span className="text-amber-600">Low (needs ≥ 0.20 ALGO)</span>} · {algo} ALGO
                  {!ok && appAddrPreview && (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <code className="break-all">{appAddrPreview}</code>
                        <button className="text-xs underline" onClick={() => navigator.clipboard.writeText(appAddrPreview)}>Copy</button>
                      </div>
                      <div className="mt-2">
                        <QRCodeCanvas value={appAddrPreview} size={128} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <span className="text-red-600">{funds.error}</span>
          )}
        </div>
      )}

      {/* Pair state panel */}
      {(pair.globals || pair.local || pair.error) && (
        <div className="text-xs text-neutral-700">
          <div className="font-semibold mb-1 flex items-center gap-2">
            <span>Pair state</span>
            <button className="text-xs underline" onClick={refreshLocal} disabled={localLoading || !hasResolvedAppId}>
              {localLoading ? 'Refreshing…' : 'Refresh local'}
            </button>
          </div>
          {pair.error && <div className="text-red-600">{pair.error}</div>}
          {pair.globals && (
            <div className="mb-1">
              Globals: {" "}
              <span>
                {(() => {
                  const g = pair.globals as any;
                  const parts: string[] = [];
                  if (g?.E != null) parts.push(`E: ${g.E}`);
                  if (g?.m != null) parts.push(`m: ${g.m}`);
                  if (g?.UNIT != null) parts.push(`UNIT: ${g.UNIT}`);
                  if (g?.phase != null) parts.push(`phase: ${g.phase}`);
                  return parts.length ? parts.join(" · ") : JSON.stringify(g);
                })()}
              </span>
            </div>
          )}
          {pair.local && (
            <div>
              Local (subject): s = {pair.local.s ?? 0}, done = {pair.local.done ?? 0}
            </div>
          )}
        </div>
      )}

      {/* s input + invest */}
      <div className="flex items-center gap-2 text-sm">
        <span>Invest s (µAlgos):</span>
        <input
          inputMode="numeric"
          pattern="\d*"
          className="border rounded px-2 py-1 w-44"
          value={sInput}
          onChange={(e) => setSInput(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={`multiple of ${unit}, ≤ ${E}`}
        />
        <button className="text-xs underline" 
          onClick={doInvest}
          disabled={investDisabled}>
          {busy==="invest" ? "Investing…" : "Invest"}
        </button>
        {alreadyInvested ? (
          <span className="text-xs text-amber-600">Already invested (done == 1).</span>
        ) : (typeof funds.balance === 'number' && funds.balance < APP_FUND_THRESHOLD) && (
          <span className="text-xs text-amber-600">App balance low; needs ≥ 0.20 ALGO</span>
        )}
      </div>

      {lastTx && <div className="text-xs">TxID: <code>{lastTx}</code></div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
      <p className="text-xs text-neutral-500">
        Requires: phase = 2, subject opted-in, 2-txn group, s multiple of UNIT, 0 ≤ s ≤ E.
      </p>
      <ToastHost />
    </div>
  );
}
