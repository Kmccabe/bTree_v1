
import { useEffect, useState, useCallback, useMemo } from "react";
import * as algosdk from "algosdk";
import { useWallet, PROVIDER_ID } from "@txnlab/use-wallet";
import { deployPlaceholderApp } from "./deploy";
import ExportCSVButton from "./components/ExportCSVButton";
import PhaseControl from "./components/PhaseControl";

export default function App(): JSX.Element {
  const {
    activeAddress,
    activeAccount,
    clients,
    providers,
    connectedAccounts,
    connectedActiveAccounts,
    signTransactions,
    status,
  } = useWallet();
  const account = activeAddress || activeAccount?.address || null;
  const network = (import.meta.env.VITE_NETWORK as string) ?? "TESTNET";
  const [deploying, setDeploying] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [appId, setAppId] = useState<number | null>(null);
  const [manifest, setManifest] = useState<null | { txid?: string; appId?: number; timestamp?: string }>(null);
  const isValidAccount = useMemo(() => account ? algosdk.isValidAddress(account) : false, [account]);
  const [debugOpen, setDebugOpen] = useState<boolean>(import.meta.env.DEV);
  const [paramsInfo, setParamsInfo] = useState<null | { fee?: any; lastRound?: any; genesisID?: any }>(null);
  const [paramsErr, setParamsErr] = useState<string | null>(null);
  const [spInfo, setSpInfo] = useState<null | any>(null);
  const [progLens, setProgLens] = useState<null | { approvalLen: number; clearLen: number }>(null);

  // use-wallet-react manages session restoration; no manual reconnect needed
  useEffect(() => {}, []);

  const handleConnect = useCallback(async () => {
    const p = providers?.find(p => p.metadata.id === PROVIDER_ID.PERA);
    const peraClient = clients?.[PROVIDER_ID.PERA];
    if (!p) {
      console.warn("Pera provider not initialized yet");
      return;
    }
    try {
      // Prefer high-level Provider.connect (manages state and activation)
      await p.connect();
      if (!p.isActive) p.setActiveProvider();
    } catch (err: any) {
      const msg = String(err?.message || err).toLowerCase();
      if (msg.includes("currently connected") && peraClient) {
        try {
          await peraClient.reconnect(() => {});
          if (!p.isActive) p.setActiveProvider();
        } catch (e) {
          console.error("Reconnect failed:", e);
        }
      } else {
        console.error("Connect failed:", err);
      }
    }
  }, [clients, providers]);

  const handleDisconnect = useCallback(async () => {
    try { await clients?.[PROVIDER_ID.PERA]?.disconnect(); } catch {}
  }, [clients]);

  // Ensure provider is marked active when accounts are present
  useEffect(() => {
    const p = providers?.find(p => p.metadata.id === PROVIDER_ID.PERA);
    const client = clients?.[PROVIDER_ID.PERA];
    if (!p || !client) return;
    let cancelled = false;
    (async () => {
      try {
        // If no accounts loaded yet, try reconnect
        if (!Array.isArray(p.accounts) || p.accounts.length === 0) {
          const wallet = await client.reconnect(() => {});
          if (cancelled) return;
          if (wallet && wallet.accounts && wallet.accounts.length) {
            if (!p.isActive) p.setActiveProvider();
          }
        } else {
          // Accounts present: ensure provider is active
          if (!p.isActive) p.setActiveProvider();
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [providers, clients, activeAccount]);

  const handleDeploy = useCallback(async () => {
    const sender = account;
    if (!sender || !algosdk.isValidAddress(sender)) {
      alert("No valid Algorand address connected. Please connect wallet.");
      return;
    }
    try {
      setDeploying(true);
      setTxid(null);
      setAppId(null);
      console.debug("Deploying with account:", sender);
      // build unsigned txn
      const { txn, b64, debug } = await deployPlaceholderApp(sender);
      setSpInfo(debug?.suggestedParams ?? null);
      setProgLens({ approvalLen: debug?.approvalLen ?? 0, clearLen: debug?.clearLen ?? 0 });
      // request signature via use-wallet
      const signed: Uint8Array[] = await signTransactions([txn.toByte()]);
      const first = signed && Array.isArray(signed) ? signed[0] : null;
      if (!first || !(first instanceof Uint8Array)) throw new Error("Pera returned unexpected signature payload");
      const signedTxnBase64 = Buffer.from(first).toString("base64");
      // submit via serverless
      const resp = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedTxnBase64 }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(JSON.stringify(j));
      const submittedTxId = j.txId || j.txid;
      setTxid(submittedTxId);
      setManifest({ txid: submittedTxId, timestamp: new Date().toISOString() });

      // poll pending info a few times for app-id
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const p = await fetch("/api/pending?txid=" + (j.txId || j.txid)).then(r => r.json());
        const app = p["application-index"];
        if (app) {
          setAppId(app);
          setManifest((m) => ({ ...(m || {}), appId: app }));
          break;
        }
      }
    } catch (e) {
      console.error(e);
      alert("Deploy failed: " + (e as Error).message);
    } finally {
      setDeploying(false);
    }
  }, [account]);

  // Pera Explorer links disabled for now

  const txJsonUrl = useMemo(() => {
    if (!txid) return null;
    const net = (network || "").toUpperCase();
    const base = net === "TESTNET" ? "https://testnet-idx.algonode.cloud" : "https://mainnet-idx.algonode.cloud";
    return `${base}/v2/transactions/${txid}`;
  }, [txid, network]);

  const appJsonUrl = useMemo(() => {
    if (!appId) return null;
    const net = (network || "").toUpperCase();
    const base = net === "TESTNET" ? "https://testnet-idx.algonode.cloud" : "https://mainnet-idx.algonode.cloud";
    return `${base}/v2/applications/${appId}`;
  }, [appId, network]);

  const loraTxUrl = useMemo(() => {
    if (!txid) return null;
    const net = (network || "").toLowerCase();
    const chain = net === "mainnet" ? "mainnet" : "testnet";
    return `https://lora.algokit.io/${chain}/tx/${txid}`;
  }, [txid, network]);

  const loraAppUrl = useMemo(() => {
    if (!appId) return null;
    const net = (network || "").toLowerCase();
    const chain = net === "mainnet" ? "mainnet" : "testnet";
    return `https://lora.algokit.io/${chain}/application/${appId}`;
  }, [appId, network]);

  const resolvedAppId = useMemo(() => {
  const envId = (import.meta.env.VITE_TESTNET_APP_ID as string) || "";
  return appId ?? (envId ? Number(envId) : undefined);
}, [appId]);


  const manifestText = useMemo(() => {
    const lines: string[] = ["Experiment Manifest"]; // title line
    if (manifest?.appId) lines.push(`App ID: ${manifest.appId}`);
    if (manifest?.txid) lines.push(`TxID: ${manifest.txid}`);
    if (manifest?.timestamp) lines.push(`Timestamp: ${manifest.timestamp}`);
    return lines.join("\n");
  }, [manifest]);

    // Resolve App ID for export: prefer live appId from deploy; otherwise use .env value
  const exportAppId = useMemo(() => {
    const envId = (import.meta.env.VITE_TESTNET_APP_ID as string) || "";
    return appId ?? (envId ? Number(envId) : undefined);
  }, [appId]);

  const handleCopyManifest = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(manifestText);
      alert("Manifest copied to clipboard");
    } catch {
      // Fallback: create a temporary textarea
      const ta = document.createElement("textarea");
      ta.value = manifestText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Manifest copied to clipboard");
    }
  }, [manifestText]);

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
      <p><strong>Network:</strong> {network} (wallet = use-wallet/Pera)</p>
      <div style={{ marginTop: 6 }}>
        <button onClick={() => window.dispatchEvent(new CustomEvent('wallet:set-network', { detail: 'testnet' }))} style={{ marginRight: 8 }}>Use TestNet</button>
        <button onClick={() => window.dispatchEvent(new CustomEvent('wallet:set-network', { detail: 'mainnet' }))}>Use MainNet</button>
        <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>(Switch wallet network to match)</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        {!account ? (
          <button onClick={handleConnect}>Connect Pera Wallet</button>
        ) : (
          <>
            <p style={{ margin: 0 }}><strong>Connected:</strong> {account}</p>
            <button onClick={handleDisconnect}>Disconnect</button>
          </>
        )}
        <button onClick={() => { try { clients?.[PROVIDER_ID.PERA]?.reconnect(() => {}); } catch {} }}>Force Reconnect</button>
        <button onClick={() => { try { clients?.[PROVIDER_ID.PERA]?.disconnect(); } catch {} }}>Reset Wallet Session</button>
      </div>

      <hr />
      <h3>Deploy placeholder app (no mnemonic; Pera signs)</h3>
      <button onClick={handleDeploy} disabled={!isValidAccount || deploying}>
        {deploying ? "Deploying..." : "Deploy to TestNet"}
      </button>

      {!isValidAccount && account && (
        <p style={{ color: "#b00" }}>Connected address looks invalid. Reconnect your wallet.</p>
      )}
      {txid && (
        <p>
          TxID: <code>{txid}</code>
          {loraTxUrl && (
            <> — <a href={loraTxUrl} target="_blank" rel="noreferrer">View in Lora</a></>
          )}
          {txJsonUrl && (
            <> — <a href={txJsonUrl} target="_blank" rel="noreferrer">View JSON</a></>
          )}
          {/* Pera Explorer link hidden for now */}
        </p>
      )}
      {appId && (
        <p>
          ✅ App ID: <strong>{appId}</strong>
          {loraAppUrl && (
            <> — <a href={loraAppUrl} target="_blank" rel="noreferrer">Open in Lora</a></>
          )}
          {appJsonUrl && (
            <> — <a href={appJsonUrl} target="_blank" rel="noreferrer">View JSON</a></>
          )}
          {/* Pera Explorer link hidden for now */}
        </p>
      )}
      {(manifest?.txid || manifest?.appId) && (
        <div style={{ marginTop: 16, border: "1px solid #ddd", padding: 12, borderRadius: 8, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <strong>Experiment Manifest</strong>
            <button onClick={handleCopyManifest}>Copy</button>
          </div>
          <div style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, lineHeight: 1.6 }}>
            {manifest?.appId && <div>App ID: {manifest.appId}</div>}
            {manifest?.txid && <div>TxID: {manifest.txid}</div>}
            {manifest?.timestamp && <div>Timestamp: {manifest.timestamp}</div>}
          </div>
        </div>
      )}
            {/* Export CSV button */}
      <div style={{ marginTop: 16 }}>
        <ExportCSVButton appId={resolvedAppId} />
      </div>
      <div style={{ marginTop: 16 }}>
        <PhaseControl appId={resolvedAppId} account={account} network={network} />
      </div>

      {false && (
        <p style={{ marginTop: 4, color: "#666" }}>
          Pera Explorer links are disabled for now.
        </p>
      )}

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
            <div>Status: {status}</div>
            <div>connectedAccounts: {connectedAccounts.length}</div>
            <div>connectedActiveAccounts: {connectedActiveAccounts.length}</div>
            <div>providers: {providers?.length ?? 0}</div>
            <div>pera.isActive: {String(!!providers?.find(p=>p.metadata.id===PROVIDER_ID.PERA)?.isActive)}</div>
            <div>
              pera.accounts:
              {(() => {
                const p = providers?.find(p=>p.metadata.id===PROVIDER_ID.PERA);
                const addrs = (p?.accounts||[]).map(a=>a.address).join(", ");
                return " [" + addrs + "]";
              })()}
            </div>
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
            {spInfo && (
              <div style={{ marginTop: 10 }}>
                <div><strong>suggestedParams</strong></div>
                <div>fee: {String((spInfo as any).fee)} (flatFee: {String((spInfo as any).flatFee)})</div>
                <div>minFee: {String((spInfo as any).minFee)}</div>
                <div>firstValid: {String((spInfo as any).firstValid)} → lastValid: {String((spInfo as any).lastValid)}</div>
                <div>genesisID: {String((spInfo as any).genesisID)}</div>
                <div>
                  genesisHash: {
                    String((spInfo as any).genesisHash instanceof Uint8Array
                      ? (window as any).Buffer.from((spInfo as any).genesisHash).toString("base64")
                      : (spInfo as any).genesisHash)
                  }
                </div>
              </div>
            )}
            {progLens && (
              <div style={{ marginTop: 6 }}>
                <div>approval length: {progLens.approvalLen}</div>
                <div>clear length: {progLens.clearLen}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
