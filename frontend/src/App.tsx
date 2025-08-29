
import { useEffect, useState, useCallback } from "react";
import { PeraWalletConnect } from "@perawallet/connect";
import { deployPlaceholderApp } from "./deploy";

const pera = new PeraWalletConnect();

export default function App(): JSX.Element {
  const [account, setAccount] = useState<string | null>(null);
  const network = (import.meta.env.VITE_NETWORK as string) ?? "TESTNET";
  const [deploying, setDeploying] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [appId, setAppId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    pera.reconnectSession().then((accounts) => {
      if (!mounted) return;
      if (accounts && accounts.length > 0) setAccount(accounts[0]);
      const conn: any = (pera as any).connector;
      if (conn?.on) conn.on("disconnect", () => setAccount(null));
      if ((pera as any).on) (pera as any).on("disconnect", () => setAccount(null));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      const accounts = await pera.connect();
      if (accounts && accounts.length > 0) setAccount(accounts[0]);
    } catch (err) {
      console.error("Pera connect failed:", err);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try { await pera.disconnect(); } catch {}
    setAccount(null);
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!account) return;
    try {
      setDeploying(true);
      setTxid(null);
      setAppId(null);
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
      <button onClick={handleDeploy} disabled={!account || deploying}>
        {deploying ? "Deploying..." : "Deploy to TestNet"}
      </button>

      {txid && <p>TxID: <code>{txid}</code></p>}
      {appId && <p>✅ App ID: <strong>{appId}</strong></p>}
    </div>
  );
}
