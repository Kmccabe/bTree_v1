import React from "react";

type Manifest = {
  name: string;
  network: string;
  appId: number | string | null;
  deployTxId?: string | null;
  algod?: string | null;
  indexer?: string | null;
  contractVersion?: string | null;
  finalizeDigest?: string | null;
  createdAt?: string | null;
};

export default function ManifestCard({ manifest }: { manifest: Manifest }) {
  const copy = async () => {
    const json = JSON.stringify(manifest, null, 2);
    await navigator.clipboard.writeText(json);
    alert("Manifest copied to clipboard");
  };

  return (
    <div style={{
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
    }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Experiment Manifest</h3>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
        <div><strong>Name:</strong> {manifest.name}</div>
        <div><strong>Network:</strong> {manifest.network}</div>
        <div><strong>App ID:</strong> {manifest.appId ?? "-"}</div>
        {manifest.deployTxId && <div><strong>Deploy TxID:</strong> <code>{manifest.deployTxId}</code></div>}
        {manifest.algod && <div><strong>Algod:</strong> {manifest.algod}</div>}
        {manifest.indexer && <div><strong>Indexer:</strong> {manifest.indexer}</div>}
        {manifest.contractVersion && <div><strong>Contract:</strong> {manifest.contractVersion}</div>}
        {manifest.finalizeDigest && <div><strong>Finalize Digest:</strong> <code>{manifest.finalizeDigest}</code></div>}
        {manifest.createdAt && <div><strong>Created:</strong> {manifest.createdAt}</div>}
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={copy}>Copy Manifest</button>
      </div>
    </div>
  );
}
