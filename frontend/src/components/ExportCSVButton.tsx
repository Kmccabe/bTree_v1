import React, { useMemo, useState } from "react";

type Props = { appId?: string | number };

export default function ExportCSVButton({ appId }: Props) {
  // Resolve app id from prop → ?appId= → VITE_TESTNET_APP_ID
  const resolvedAppId = useMemo(() => {
    if (appId) return String(appId);
    const url = new URL(window.location.href);
    const q = url.searchParams.get("appId");
    if (q) return q;
    const env = import.meta.env.VITE_TESTNET_APP_ID as string | undefined;
    return env ?? "";
  }, [appId]);

  const [minRound, setMinRound] = useState<string>("");
  const [maxRound, setMaxRound] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const isPureVite = typeof window !== "undefined" && window.location.port === "5173";
  const base =
    isPureVite && (import.meta.env.VITE_PUBLIC_API_BASE as string | undefined)
      ? (import.meta.env.VITE_PUBLIC_API_BASE as string).replace(/\/$/, "")
      : "";

  const href = useMemo(() => {
    if (!resolvedAppId) return "#";
    const p = new URLSearchParams({ appId: String(resolvedAppId) });
    if (minRound) p.set("minRound", minRound);
    if (maxRound) p.set("maxRound", maxRound);
    return `${base}/api/export?${p.toString()}`;
  }, [resolvedAppId, minRound, maxRound, base]);

  async function prefillFromIndexer() {
    if (!resolvedAppId) return;
    try {
      setBusy(true);
      const idx =
        (import.meta.env.VITE_TESTNET_INDEXER_URL as string) ||
        "https://testnet-idx.algonode.cloud";
      const r = await fetch(`${idx.replace(/\/$/, "")}/v2/applications/${resolvedAppId}`);
      const j = await r.json();
      const created = j?.application?.["created-at-round"];
      if (created) setMinRound(String(created));
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  const disabled = !resolvedAppId || (isPureVite && !base); // /api not available under pure vite

  return (
    <div
      style={{
        marginTop: 16,
        border: "1px solid #ddd",
        padding: 12,
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong>Export CSV</strong>
      </div>
      <div style={{ marginTop: 6, color: "#444", fontSize: 13 }}>
        Exports on-chain events via the Indexer.{" "}
        <span style={{ color: "#666" }}>
          (Optional filters: <em>round</em> range. Leave blank for all.)
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <input
          style={{ border: "1px solid #ccc", borderRadius: 6, padding: "6px 8px", fontSize: 13, minWidth: 180 }}
          type="text"
          inputMode="numeric"
          placeholder="minRound (optional)"
          value={minRound}
          onChange={(e) => setMinRound(e.target.value)}
        />
        <input
          style={{ border: "1px solid #ccc", borderRadius: 6, padding: "6px 8px", fontSize: 13, minWidth: 180 }}
          type="text"
          inputMode="numeric"
          placeholder="maxRound (optional)"
          value={maxRound}
          onChange={(e) => setMaxRound(e.target.value)}
        />
        <a
          href={href}
          download
          style={{
            pointerEvents: disabled ? "none" : "auto",
            opacity: disabled ? 0.5 : 1,
            background: "#111",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Download CSV
        </a>
        <button
          onClick={prefillFromIndexer}
          disabled={!resolvedAppId || busy}
          style={{
            background: "#f5f5f5",
            border: "1px solid #ccc",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            cursor: busy ? "wait" : "pointer",
          }}
          title="Fetch the app's created-at-round from the Indexer and fill minRound"
        >
          {busy ? "Prefilling…" : "Prefill min from Indexer"}
        </button>
      </div>

      {!resolvedAppId && (
        <div style={{ marginTop: 8, color: "#b00", fontSize: 12 }}>
          No App ID found. Deploy once, open with <code>?appId=…</code>, or set <code>VITE_TESTNET_APP_ID</code>.
        </div>
      )}
      {isPureVite && !base && (
        <div style={{ marginTop: 8, color: "#b07", fontSize: 12 }}>
          API routes aren’t available under <code>vite dev</code>. Run <code>npx vercel dev</code> or set{" "}
          <code>VITE_PUBLIC_API_BASE</code> to your deployed domain.
        </div>
      )}
    </div>
  );
}
