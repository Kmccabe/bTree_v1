
import { useEffect, useState, useCallback, useMemo } from "react";
import algosdk from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";
import { deployPlaceholderApp } from "./deploy";

const pera = new PeraWalletConnect();

export default function App(): JSX.Element {
  const [account, setAccount] = useState<string | null>(null);
  const network = (import.meta.env.VITE_NETWORK as string) ?? "TESTNET";
  const [deploying, setDeploying] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [appId, setAppId] = useState<number | null>(null);
  const isValidAccount = useMemo(() => account ? algosdk.isValidAddress(account) : false, [account]);
  const [debugOpen, setDebugOpen] = useState<boolean>(import.meta.env.DEV);
  const [paramsInfo, setParamsInfo] = useState<null | { fee?: any; lastRound?: any; genesisID?: any }>(null);
  const [paramsErr, setParamsErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    pera.reconnectSession().then((accounts) => {
      if (!mounted) return;
      if (accounts && accounts.length > 0) {
        const a = (accounts[0] ?? "").toString().trim().toUpperCase();
        setAccount(a);
      }
      const conn: any = (pera as any).connector;
      if (conn?.on) conn.on("disconnect", () => setAccount(null));
      if ((pera as any).on) (pera as any).on("disconnect", () => setAccount(null));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      const accounts = await pera.connect();
      if (accounts && accounts.length > 0) {
        const a = (accounts[0] ?? "").toString().trim().toUpperCase();
        setAccount(a);
      }
    } catch (err) {
      console.error("Pera connect failed:", err);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try { await pera.disconnect(); } catch {}
    setAccount(null);
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!account || !algosdk.isValidAddress(account)) {
      alert("No valid Algorand address connected. Please reconnect Pera.");
      return;
    }
    try {
      setDeploying(true);
      setTxid(null);
      setAppId(null);
      console.debug("Deploying with account:", account);
      // build unsigned txn
      const { b64 } = await deployPlaceholderApp(account);
      // request signature from Pera
      // @ts-ignore
      const signed = await pera.signTransaction([{ txn: b64 }]);
      const signedTxnBase64 = Array.isArray(signed) ? signed[0] : signed;
      // submit via serverless
      const resp = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedTxnBase64 }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(JSON.stringify(j));
      setTxid(j.txId || j.txid);

      // poll pending info a few times for app-id
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const p = await fetch("/api/pending?txid=" + (j.txId || j.txid)).then(r => r.json());
        const app = p["application-index"];
        if (app) { setAppId(app); break; }
      }
    } catch (e) {
      console.error(e);
      alert("Deploy failed: " + (e as Error).message);
    } finally {
      setDeploying(false);
    }
  }, [account]);

  const handlePingParams = useCallback(async () => {
    setParamsErr(null);
    setParamsInfo(null);
    try {
      const r = await fetch("/api/params");
      const j = await r.json();
      setParamsInfo({
        fee: j.fee ?? j["min-fee"],
        lastRound: j["last-round"],
        genesisID: j["genesis-id"],
      });
    } catch (e: any) {
      setParamsErr(e?.message || "Ping failed");
    }
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, Arial", padding: 24 }}>
      <h1>bTree v1 — Trust Game MVP</h1>
      <p><strong>Network:</strong> {network} (wallet = Pera on TestNet)</p>

      {!account ? (
        <button onClick={handleConnect}>Connect Pera Wallet</button>
      ) : (
        <div>
          <p><strong>Connected:</strong> {account}</p>
          <button onClick={handleDisconnect}>Disconnect</button>
        </div>
      )}

      <hr />
      <h3>Deploy placeholder app (no mnemonic; Pera signs)</h3>
      <button onClick={handleDeploy} disabled={!isValidAccount || deploying}>
        {deploying ? "Deploying..." : "Deploy to TestNet"}
      </button>

      {!isValidAccount && account && (
        <p style={{ color: "#b00" }}>Connected address looks invalid. Reconnect your wallet.</p>
      )}
      {txid && <p>TxID: <code>{txid}</code></p>}
      {appId && <p>✅ App ID: <strong>{appId}</strong></p>}

      <div style={{ marginTop: 24, border: "1px dashed #bbb", padding: 12, borderRadius: 6, background: "#fafafa" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong>Debug Panel</strong>
          <button onClick={() => setDebugOpen(v => !v)}>{debugOpen ? "Hide" : "Show"}</button>
        </div>
        {debugOpen && (
          <div style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>
            <div>Network: {network}</div>
            <div>Account: {account || "(none)"}</div>
            <div>Valid: {String(isValidAccount)}</div>
            <div>Location: {typeof window !== 'undefined' ? window.location.origin : ''}</div>
            <div style={{ marginTop: 8 }}>
              <button onClick={handlePingParams}>Ping /api/params</button>
            </div>
            {paramsInfo && (
              <div style={{ marginTop: 6 }}>
                <div>params.fee: {String(paramsInfo.fee)}</div>
                <div>params.last-round: {String(paramsInfo.lastRound)}</div>
                <div>params.genesis-id: {String(paramsInfo.genesisID)}</div>
              </div>
            )}
            {paramsErr && (
              <div style={{ marginTop: 6, color: "#b00" }}>params error: {paramsErr}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
