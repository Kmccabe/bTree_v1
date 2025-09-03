import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@txnlab/use-wallet";
import algosdk from "algosdk";
import { investFlow, optInApp } from "../chain/tx";
import { resolveAppId, setSelectedAppId, getSelectedAppId, clearSelectedAppId } from "../state/appId";
import { getAccountBalanceMicroAlgos } from "../chain/balance";
import { QRCodeCanvas } from "qrcode.react";

export default function SubjectActions() {
  const { activeAddress, signTransactions } = useWallet();

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
      const local = { s, done };

      setPair({ loading: false, error: null, globals, local });
      setLocalS(local.s);
      setLocalDone(local.done);
    } catch (e: any) {
      console.error("[SubjectActions] readPairStates failed", e);
      setPair({ loading: false, error: e?.message || String(e), globals: null, local: null });
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
    const client = new (algosdk as any).Algodv2(token, server, "");
    const ai = await client.accountApplicationInformation(subjectAddr, appId).do();
    const kv: any[] = ai?.["app-local-state"]?.["key-value"] || ai?.["key-value"] || [];
    const localMap: Record<string, any> = {};
    for (const entry of kv) {
      const keyB64 = String(entry?.key ?? "");
      let key = "";
      try { key = atob(keyB64); } catch { try { key = (typeof Buffer !== 'undefined' ? Buffer.from(keyB64, 'base64').toString('utf8') : ""); } catch { key = ""; } }
      const v = entry?.value;
      if (v?.type === 2) localMap[key] = Number(v?.uint ?? 0);
    }
    return { s: Number(localMap.s ?? 0), done: Number(localMap.done ?? 0) };
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
      const id = resolveAppId();
      console.info("[appId] resolved =", id);
      console.debug("[SubjectActions] invest submit", { sender: activeAddress, appId: id, s });
      const r = await investFlow({
        sender: activeAddress,
        appId: id,
        s,
        sign: (u) => signTransactions(u),
      });
      console.debug("[SubjectActions] invest result", r);
      setLastTx(r.txId);
    } catch (e: any) {
      console.error("[SubjectActions] invest failed", e);
      setErr(e?.message || String(e));
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
    <div className="rounded-2xl border p-4 space-y-3">
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
          <div className="font-semibold mb-1">Pair state</div>
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
    </div>
  );
}
