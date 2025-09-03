import React, { useEffect, useState } from "react";
import { useWallet } from "@txnlab/use-wallet";
import algosdk from "algosdk";
import { investFlow, optInApp } from "../chain/tx";
import { resolveAppId, setSelectedAppId, getSelectedAppId } from "../state/appId";
import { getAccountBalanceMicroAlgos } from "../chain/balance";
import { QRCodeCanvas } from "qrcode.react";

export default function SubjectActions() {
  const { activeAddress, signTransactions } = useWallet();

  // inputs
  const [appIdIn, setAppIdIn] = useState<string>("");
  // Initialize App ID input from selected/global value if available
  useEffect(() => {
    if (!appIdIn) {
      const sel = getSelectedAppId();
      if (sel && Number.isInteger(sel) && sel > 0) {
        setAppIdIn(String(sel));
      } else {
        const raw = (import.meta as any)?.env?.VITE_TESTNET_APP_ID as string | undefined;
        const parsed = raw != null ? Number(raw) : NaN;
        if (Number.isInteger(parsed) && parsed > 0) setAppIdIn(String(parsed));
      }
    }
  }, [appIdIn]);
  const [unit, setUnit] = useState<number>(1000);
  const [E, setE] = useState<number>(100000);

  // invest uses string to avoid leading-zero quirks
  const [sInput, setSInput] = useState<string>("");

  // ui state
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [funds, setFunds] = useState<{ balance?: number; checking: boolean; error?: string }>({ checking: false });

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

  const investDisabled =
    !!busy || !activeAddress || !hasResolvedAppId ||
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
            setAppIdIn(e.target.value);
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n > 0) setSelectedAppId(n);
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
      </div>

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
        {(typeof funds.balance === 'number' && funds.balance < APP_FUND_THRESHOLD) && (
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
