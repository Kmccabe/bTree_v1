import React, { useEffect, useState } from "react";
import { useWallet } from "@txnlab/use-wallet";
import { deployTrustGame } from "../deploy";
import QRCode from "qrcode";

const nf = (n: number) => Intl.NumberFormat().format(n);

export default function AdminSetup() {
  const { activeAddress, signTransactions } = useWallet();
  const [E, setE] = useState<number>(100_000);     // 0.1 ALGO default (µAlgos)
  const [m, setM] = useState<number>(3);
  const [UNIT, setUNIT] = useState<number>(1_000); // step size in µAlgos
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [appId, setAppId] = useState<number | null>(null);
  const [addr, setAddr] = useState<string | null>(null);
  const [fund, setFund] = useState<{ required: number; balance?: number; ok?: boolean } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [globals, setGlobals] = useState<any | null>(null);
  const [globals, setGlobals] = useState<any | null>(null);

  const required = (m - 1) * E + 50_000; // conservative buffer

  async function onDeploy() {
    setBusy("deploy"); setErr(null);
    try {
      if (!activeAddress) throw new Error("Connect the experimenter wallet first.");
      const r = await deployTrustGame({
        sender: activeAddress,
        E, m, UNIT,
        sign: (u) => signTransactions(u),
      });
      setAppId(r.appId);
      setAddr(r.appAddress);
    } catch (e: any) {
      setErr(e?.message || String(e));
      console.error(e);
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

  // whenever addr or showQR changes, (re)generate QR
  useEffect(() => {
    let cancelled = false;
    async function gen() {
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
    }
    gen();
    return () => { cancelled = true; };
  }, [addr, showQR]);

  // Lora link for the application
  const netLower = ((import.meta as any).env?.VITE_NETWORK || "testnet").toLowerCase();
  const chain = netLower === "mainnet" ? "mainnet" : "testnet";
  const loraAppHref = appId ? `https://lora.algokit.io/${chain}/application/${appId}` : null;

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <h3 className="text-lg font-semibold">Admin — Deploy & Fund (per pair)</h3>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col">
          <span className="text-sm">Endowment E (µAlgos)</span>
          <input type="number" min={0} step={UNIT || 1} value={E}
                 onChange={(e)=>setE(Number(e.target.value))}
                 className="border rounded p-2" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">Multiplier m</span>
          <input type="number" min={1} step={1} value={m}
                 onChange={(e)=>setM(Number(e.target.value))}
                 className="border rounded p-2" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">UNIT (µAlgos step)</span>
          <input type="number" min={1} step={1} value={UNIT}
                 onChange={(e)=>setUNIT(Number(e.target.value))}
                 className="border rounded p-2" />
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
            {loraAppHref && (
              <a
                href={loraAppHref}
                target="_blank" rel="noreferrer"
                className="text-xs underline"
              >
                View in Lora
              </a>
            )}
            <button
              onClick={async () => {
                if (!appId) return;
                try {
                  const r = await fetch(`/api/pair?id=${appId}`);
                  const j = await r.json();
                  setGlobals(j?.globals || null);
                } catch (e) {
                  setGlobals(null);
                }
              }}
              disabled={!!busy || !appId}
              className="text-xs underline"
            >
              Read pair state
            </button>
          </div>
          {showQR && qrDataUrl && (
            <div className="p-2 border inline-block rounded">
              <img src={qrDataUrl} alt="App Address QR" width={200} height={200} />
            </div>
          )}
          {globals && (
            <div className="text-xs text-neutral-700">
              E: {globals.E ?? "?"} · m: {globals.m ?? "?"} · UNIT: {globals.UNIT ?? "?"} · phase: {globals.phase ?? "?"}
            </div>
          )}
          <div className="text-sm">
            <button
              onClick={async () => {
                if (!appId) return;
                try {
                  const r = await fetch(`/api/pair?id=${appId}`);
                  const j = await r.json();
                  setGlobals(j?.globals || null);
                } catch (e) {
                  setGlobals(null);
                }
              }}
              disabled={!!busy || !appId}
              className="text-xs underline ml-0"
            >
              Read pair state
            </button>
          </div>
          {globals && (
            <div className="text-xs text-neutral-700">
              E: {globals.E ?? "?"} · m: {globals.m ?? "?"} · UNIT: {globals.UNIT ?? "?"} · phase: {globals.phase ?? "?"}
            </div>
          )}
          <div className="text-sm">
            Required pool (est.): <b>{nf(required)}</b> µAlgos ·
            <button onClick={checkFunding} disabled={!!busy} className="underline ml-2">Check funding</button>
            {fund && (
              <span className={`ml-2 ${fund.ok ? "text-green-600" : "text-amber-600"}`}>
                {fund.balance != null ? `Balance ${nf(fund.balance)} µAlgos` : ""} {fund.ok ? "(OK)" : "(Needs funds)"}
              </span>
            )}
          </div>
        </div>
      )}

      {err && <div className="text-sm text-red-600">{err}</div>}

      <p className="text-xs text-neutral-500">
        This deploys globals E, m, UNIT and sets phase=1. Invest/Return come next.
      </p>
    </div>
  );
}
