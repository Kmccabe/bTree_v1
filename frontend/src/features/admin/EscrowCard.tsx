import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useToast } from "../../components/Toaster";
import { compileEscrowStream, mockCompileEscrowStream } from "../../lib/api/compileEscrowStream";
import {
  EscrowStatus,
  MIN_READY_MICROALGOS,
  formatAlgos,
  getEscrowAddress,
  getEscrowBalance,
  networkExplorerUrl,
} from "../escrow/api";

const TRUNCATED_LABEL = "[truncated] showing last 2000 lines";
const NEAR_BOTTOM_EPSILON = 48;
const USE_MOCK_COMPILE = import.meta.env.VITE_DEV_MOCK_COMPILE === "1";
const COMPILE_STREAM = USE_MOCK_COMPILE ? mockCompileEscrowStream : compileEscrowStream;

type FetchState = {
  balance?: bigint;
  loading: boolean;
  error?: string;
};

type CompileStatus = "idle" | "running" | "success" | "failed" | "canceled";

const FUND_STATUS_META: Record<EscrowStatus, { label: string; className: string }> = {
  not_configured: { label: "Not configured", className: "bg-gray-100 text-gray-700" },
  needs_funding: { label: "Needs funding (<1 ALGO)", className: "bg-amber-100 text-amber-800" },
  ready: { label: "Ready (=1 ALGO)", className: "bg-emerald-100 text-emerald-800" },
  unknown: { label: "Status unknown", className: "bg-slate-100 text-slate-700" },
};

const COMPILE_STATUS_META: Record<CompileStatus, { label: string; className: string }> = {
  idle: { label: "Idle", className: "bg-gray-100 text-gray-700" },
  running: { label: "Running", className: "bg-blue-100 text-blue-800" },
  success: { label: "Success", className: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
  canceled: { label: "Canceled", className: "bg-slate-100 text-slate-700" },
};

export type EscrowCardProps = {
  onEscrowCompiled?: (addr: string) => void;
};

export function EscrowCard(props?: EscrowCardProps): JSX.Element {
  const { onEscrowCompiled } = props ?? {};
  const toast = useToast();
  const address = getEscrowAddress();
  const [{ balance, loading, error }, setFetchState] = useState<FetchState>({
    loading: Boolean(address),
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const [compileStatus, setCompileStatus] = useState<CompileStatus>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [compiledEscrow, setCompiledEscrow] = useState<string | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewOutput, setHasNewOutput] = useState(false);

  const truncatedRef = useRef(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!address) {
      setFetchState({ loading: false });
      return;
    }
    setFetchState({ loading: true });
    (async () => {
      try {
        const nextBalance = await getEscrowBalance(address);
        if (!cancelled) setFetchState({ balance: nextBalance, loading: false });
      } catch (err) {
        if (!cancelled) {
          setFetchState({
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

  const fundingStatus: EscrowStatus = useMemo(() => {
    if (!address) return "not_configured";
    if (error) return "unknown";
    if (typeof balance === "bigint") {
      return balance >= MIN_READY_MICROALGOS ? "ready" : "needs_funding";
    }
    return "unknown";
  }, [address, balance, error]);

  const handleRetryBalance = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => {
      let next = [...prev, line];
      if (next.length > 2000) {
        if (!truncatedRef.current) {
          truncatedRef.current = true;
          next = [TRUNCATED_LABEL, ...next.slice(next.length - 1999)];
        } else {
          const tail = next.slice(next.length - 1999);
          next = [TRUNCATED_LABEL, ...tail];
        }
      }
      return next;
    });
  }, []);

  const pushLog = useCallback(
    (line: string) => {
      appendLog(line);
      setHasNewOutput((prev) => (!nearBottomRef.current ? true : prev));
    },
    [appendLog]
  );

  const resetLogs = useCallback(() => {
    truncatedRef.current = false;
    setLogs([]);
    setHasNewOutput(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    const node = logContainerRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, []);

  useEffect(() => {
    if (!isPanelOpen) return;
    if (isNearBottom) {
      scrollToBottom();
      if (hasNewOutput) {
        setHasNewOutput(false);
      }
    }
  }, [logs, isNearBottom, isPanelOpen, hasNewOutput, scrollToBottom]);

  const handleCopyAddress = useCallback(() => {
    if (!address || !navigator?.clipboard?.writeText) return;
    navigator.clipboard.writeText(address).catch(() => {});
  }, [address]);

  const handleCopyLogs = useCallback(() => {
    if (!navigator?.clipboard?.writeText) {
      toast.error("Copy failed — try again or select text manually.");
      return;
    }
    const body = logs.join("\n");
    navigator.clipboard
      .writeText(body)
      .then(() => toast.success(`Copied log (${logs.length} lines)`))
      .catch(() => toast.error("Copy failed — try again or select text manually."));
  }, [logs, toast]);

  const handleCompile = useCallback(async () => {
    if (compileStatus === "running") return;
    setPanelOpen(true);
    resetLogs();
    setCompiledEscrow(null);
    setCompileStatus("running");
    setIsNearBottom(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let completed = false;

    try {
      for await (const event of COMPILE_STREAM(controller.signal)) {
        if (controller.signal.aborted) break;
        if (typeof event === "string") {
          pushLog(event);
          continue;
        }
        if (controller.signal.aborted) break;
        completed = true;
        if (event.ok) {
          pushLog("[done] compile succeeded");
          setCompileStatus("success");
          if (event.escrow) {
            setCompiledEscrow(event.escrow);
            onEscrowCompiled?.(event.escrow);
          }
        } else {
          pushLog("[error] compile failed (see logs)");
          setCompileStatus("failed");
        }
        break;
      }
      if (!completed && !controller.signal.aborted) {
        pushLog("[error] compile failed (see logs)");
        setCompileStatus("failed");
      }
    } catch {
      if (!controller.signal.aborted) {
        pushLog("[error] compile failed (see logs)");
        setCompileStatus("failed");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [compileStatus, onEscrowCompiled, pushLog, resetLogs]);

  const handleCancel = useCallback(() => {
    const ctrl = abortRef.current;
    if (!ctrl) return;
    ctrl.abort();
    abortRef.current = null;
    pushLog("[canceled] compile aborted by user");
    setCompileStatus("canceled");
  }, [pushLog]);

  const handleScrollLogs = useCallback(() => {
    const node = logContainerRef.current;
    if (!node) return;
    const near =
      node.scrollHeight - (node.scrollTop + node.clientHeight) <= NEAR_BOTTOM_EPSILON;
    setIsNearBottom(near);
    if (near) setHasNewOutput(false);
  }, []);

  const handleShowNewOutput = useCallback(() => {
    scrollToBottom();
    setHasNewOutput(false);
    setIsNearBottom(true);
  }, [scrollToBottom]);

  useEffect(() => {
    nearBottomRef.current = isNearBottom;
  }, [isNearBottom]);

  const handleClearLogs = useCallback(() => {
    resetLogs();
    setCompiledEscrow(null);
  }, [resetLogs]);

  const explorerUrl = address ? networkExplorerUrl(address) : null;
  const fundingMeta = FUND_STATUS_META[fundingStatus];
  const compileMeta = COMPILE_STATUS_META[compileStatus];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Escrow (Compile &amp; Fund)</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${fundingMeta.className}`}>
          {fundingMeta.label}
        </span>
      </header>

      <div className="space-y-3 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Address</span>
          {address ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">
                {address}
              </code>
              <button
                type="button"
                onClick={handleCopyAddress}
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
                <span className="text-xs text-gray-500">
                  LocalNet explorer: run <code>algokit explore</code>.
                </span>
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
            <div className="text-sm text-gray-600">Fetching balance...</div>
          ) : error ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <p className="text-sm">
                Unable to determine balance: {error}.{" "}
                <span className="font-medium">Set VITE_INDEXER_URL and token if required.</span>
              </p>
              <button
                type="button"
                onClick={handleRetryBalance}
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCompile}
          disabled={compileStatus === "running"}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-wait disabled:text-gray-400"
        >
          {compileStatus === "running" && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          )}
          Compile Escrow (AlgoKit)
        </button>
        {compileStatus === "running" && (
          <button
            type="button"
            onClick={handleCancel}
            title="Abort compile"
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled
          title="Funding action arrives in Step 3."
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 cursor-not-allowed"
        >
          Fund Escrow
        </button>
      </div>

      <div className="rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          className="flex w-full items-center justify-between bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700"
        >
          <span>Compile logs</span>
          <span>{isPanelOpen ? "▾" : "▸"}</span>
        </button>
        {isPanelOpen && (
          <div className="space-y-3 border-t border-gray-200 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${compileMeta.className}`}
              >
                {compileMeta.label}
              </span>
              {compiledEscrow && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  Escrow: {compiledEscrow}
                </span>
              )}
              {hasNewOutput && (
                <button
                  type="button"
                  onClick={handleShowNewOutput}
                  className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800"
                >
                  New output
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="rounded border px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="rounded border px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Copy all
                </button>
              </div>
            </div>
            <div
              ref={logContainerRef}
              onScroll={handleScrollLogs}
              data-testid="compile-log-container"
              className="max-h-56 overflow-y-auto rounded border bg-gray-900 p-2 text-xs text-gray-100"
            >
              <pre className="whitespace-pre-wrap">
                {logs.length === 0 ? "No output yet." : logs.join("\n")}
              </pre>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}



