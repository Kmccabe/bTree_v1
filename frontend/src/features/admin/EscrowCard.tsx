import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EscrowStatus,
  MIN_READY_MICROALGOS,
  formatAlgos,
  getEscrowAddress,
  getEscrowBalance,
  networkExplorerUrl,
} from "../escrow/api";

type FetchState = {
  balance?: bigint;
  loading: boolean;
  error?: string;
};

const STATUS_META: Record<
  EscrowStatus,
  { label: string; className: string }
> = {
  not_configured: { label: "Not configured", className: "bg-gray-100 text-gray-700" },
  needs_funding: { label: "Needs funding (<1 ALGO)", className: "bg-amber-100 text-amber-800" },
  ready: { label: "Ready (≥1 ALGO)", className: "bg-emerald-100 text-emerald-800" },
  unknown: { label: "Status unknown", className: "bg-slate-100 text-slate-700" },
};

export function EscrowCard(): JSX.Element {
  const address = getEscrowAddress();
  const [{ balance, loading, error }, setState] = useState<FetchState>({
    loading: Boolean(address),
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!address) {
      setState({ loading: false });
      return;
    }

    setState({ loading: true });
    (async () => {
      try {
        const nextBalance = await getEscrowBalance(address);
        if (!cancelled) {
          setState({ balance: nextBalance, loading: false });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  const status: EscrowStatus = useMemo(() => {
    if (!address) return "not_configured";
    if (error) return "unknown";
    if (typeof balance === "bigint") {
      return balance >= MIN_READY_MICROALGOS ? "ready" : "needs_funding";
    }
    return loading ? "unknown" : "unknown";
  }, [address, balance, error, loading]);

  const handleRetry = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const handleCopy = useCallback(() => {
    if (!address || !navigator?.clipboard?.writeText) return;
    navigator.clipboard.writeText(address).catch(() => {
      // swallow; UI remains unchanged
    });
  }, [address]);

  const explorerUrl = address ? networkExplorerUrl(address) : null;
  const statusMeta = STATUS_META[status];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Escrow (Compile &amp; Fund)</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
          {statusMeta.label}
        </span>
      </header>

      <div className="space-y-2 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Address</span>
          {address ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">
                {address}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded border px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                aria-label="Copy escrow address"
              >
                Copy
              </button>
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Open in Explorer
                </a>
              ) : (
                <span className="text-xs text-gray-500">LocalNet explorer: run `algokit explore`.</span>
              )}
            </div>
          ) : (
            <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-gray-600">
              Generate escrow via <code>algokit task compile-escrow</code> then set{" "}
              <code>VITE_BANK_ESCROW_ADDR</code>.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Balance</span>
          {loading ? (
            <div className="text-sm text-gray-600">Fetching balance…</div>
          ) : error ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <p className="text-sm">
                Unable to determine balance: {error}.{" "}
                <span className="font-medium">Set VITE_INDEXER_URL and token if required.</span>
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-2 inline-flex items-center rounded border border-amber-400 px-2 py-1 text-xs font-medium text-amber-800"
              >
                Retry
              </button>
            </div>
          ) : typeof balance === "bigint" ? (
            <p className="text-sm font-medium text-gray-900">
              Balance: {formatAlgos(balance)} ALGO
            </p>
          ) : (
            <p className="text-sm text-gray-600">Balance unknown.</p>
          )}
        </div>
      </div>

  <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          disabled
          title="Run `algokit task compile-escrow` locally; logs coming in Step 2."
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500 cursor-not-allowed"
        >
          Compile Escrow (AlgoKit)
        </button>
        <button
          type="button"
          disabled
          title="Funding action arrives in Step 3."
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500 cursor-not-allowed"
        >
          Fund Escrow
        </button>
      </div>
    </section>
  );
}
