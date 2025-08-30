import React, { useMemo, useState } from "react";

// Reads appId from (1) prop, (2) ?appId= query, (3) VITE_TESTNET_APP_ID
function useAppId(fallback?: string | number) {
  return useMemo(() => {
    if (fallback) return String(fallback);
    const url = new URL(window.location.href);
    const q = url.searchParams.get("appId");
    if (q) return q;
    const env = import.meta.env.VITE_TESTNET_APP_ID as string | undefined;
    return env ?? "";
  }, [fallback]);
}

/**
 * ExportCSVButton
 * - Renders a link to /api/export?appId=... with optional min/max rounds
 * - Works in Vercel/`vercel dev` (serverless available)
 * - If running pure `vite dev` (no /api), you can optionally set VITE_PUBLIC_API_BASE
 *   to your deployed domain (e.g. https://btree-v1.vercel.app).
 */
export default function ExportCSVButton(props: { appId?: string | number }) {
  const appId = useAppId(props.appId);
  const [minRound, setMinRound] = useState<string>("");
  const [maxRound, setMaxRound] = useState<string>("");

  // Detect if we're on pure Vite dev (5173) where /api/* won't exist
  const isPureVite = typeof window !== "undefined" && window.location.port === "5173";
  const base = isPureVite
    ? (import.meta.env.VITE_PUBLIC_API_BASE as string | undefined) || ""
    : ""; // relative works on Vercel / vercel dev

  const href = useMemo(() => {
    if (!appId) return "#";
    const params = new URLSearchParams({ appId: String(appId) });
    if (minRound) params.set("minRound", minRound);
    if (maxRound) params.set("maxRound", maxRound);
    const prefix = base ? base.replace(/\/$/, "") : "";
    return `${prefix}/api/export?${params.toString()}`;
  }, [appId, minRound, maxRound, base]);

  const disabled = !appId;

  return (
    <div className="flex flex-col gap-2 rounded-2xl p-4 border border-gray-200">
      <div className="text-sm font-medium">Export CSV</div>
      <div className="text-xs text-gray-600">
        {isPureVite && !base ? (
          <span>
            API routes aren’t available under <code>vite dev</code>. Run{" "}
            <code>npx vercel dev</code> or set{" "}
            <code>VITE_PUBLIC_API_BASE</code> to your deployed domain.
          </span>
        ) : (
          <span>Exports on-chain events via the Indexer.</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="border rounded-md px-2 py-1 text-sm"
          type="text"
          inputMode="numeric"
          placeholder="minRound (optional)"
          value={minRound}
          onChange={(e) => setMinRound(e.target.value)}
        />
        <input
          className="border rounded-md px-2 py-1 text-sm"
          type="text"
          inputMode="numeric"
          placeholder="maxRound (optional)"
          value={maxRound}
          onChange={(e) => setMaxRound(e.target.value)}
        />
        <a
          href={href}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
            disabled
              ? "bg-gray-200 text-gray-500 pointer-events-none"
              : "bg-black text-white hover:opacity-90"
          }`}
          download // hint browser to download
        >
          {disabled ? "App ID required" : "Download CSV"}
        </a>
      </div>

      {!appId && (
        <div className="text-xs text-red-600">
          No App ID found. Pass <code>?appId=</code> in URL, set{" "}
          <code>VITE_TESTNET_APP_ID</code> in <code>.env.local</code>, or pass{" "}
          <code>&lt;ExportCSVButton appId=... /&gt;</code>.
        </div>
      )}
    </div>
  );
}
