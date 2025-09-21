import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HealthSummary, ProbeResult } from "../../api/health.js";

const REQUEST_TIMEOUT_MS = 5000;
const AUTO_REFRESH_MS = 15000;

type OverallStatus = "OK" | "DEGRADED" | "DOWN";
type ConsistencyStatus = "OK" | "WARN" | "FAIL";

const toneStyles: Record<"ok" | "warn" | "down", { background: string; color: string; border: string }> = {
  ok: { background: "#ECFDF3", color: "#027A48", border: "#BBF7D0" },
  warn: { background: "#FEF3C7", color: "#92400E", border: "#FCD34D" },
  down: { background: "#FEE2E2", color: "#B91C1C", border: "#FCA5A5" }
};

function pillLabel(status: OverallStatus | ConsistencyStatus): string {
  switch (status) {
    case "DEGRADED":
      return "Degraded";
    case "DOWN":
      return "Down";
    case "WARN":
      return "Warn";
    case "FAIL":
      return "Fail";
    default:
      return "OK";
  }
}

function toneForStatus(status: OverallStatus): "ok" | "warn" | "down" {
  if (status === "OK") return "ok";
  if (status === "DEGRADED") return "warn";
  return "down";
}

function toneForConsistency(status: ConsistencyStatus): "ok" | "warn" | "down" {
  if (status === "OK") return "ok";
  if (status === "WARN") return "warn";
  return "down";
}

function Pill({ label, tone }: { label: string; tone: "ok" | "warn" | "down" }) {
  const palette = toneStyles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.125rem 0.6rem",
        borderRadius: 9999,
        fontWeight: 600,
        fontSize: "0.72rem",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color
      }}
    >
      {label}
    </span>
  );
}

function computeOverallStatus(summary: HealthSummary): OverallStatus {
  if (summary.algod.status === "DOWN" || summary.indexer.status === "DOWN") {
    return "DOWN";
  }
  if (
    summary.algod.status === "DEGRADED" ||
    summary.indexer.status === "DEGRADED" ||
    summary.consistency === "WARN"
  ) {
    return "DEGRADED";
  }
  return "OK";
}

function formatTime(input: string | null): string {
  if (!input) return "—";
  const time = new Date(input);
  if (Number.isNaN(time.getTime())) {
    return "—";
  }
  return time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatLatency(latencyMs: number | null): string {
  if (latencyMs === null || Number.isNaN(latencyMs)) return "—";
  return `${latencyMs} ms`;
}

function formatRound(round: number | null): string {
  return typeof round === "number" && Number.isFinite(round) ? round.toString() : "—";
}

function ServiceCard({
  title,
  network,
  probe
}: {
  title: string;
  network: string;
  probe: ProbeResult | null;
}) {
  const status = probe?.status ?? "DOWN";
  const tone = toneForStatus(status);
  const details = probe?.details ?? (status === "OK" ? "Operating normally." : undefined);
  return (
    <article
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={{ fontSize: "1rem", fontWeight: 600 }}>{title}</span>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "0.1rem 0.4rem",
              borderRadius: 9999,
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              color: "#1D4ED8",
              fontWeight: 500
            }}
          >
            {network}
          </span>
        </div>
        <Pill label={pillLabel(status)} tone={tone} />
      </header>

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.5rem 1.5rem",
          fontSize: "0.9rem"
        }}
      >
        <div>
          <dt style={{ color: "#6B7280", fontSize: "0.75rem" }}>Round</dt>
          <dd style={{ margin: 0, fontWeight: 600, fontSize: "1rem" }}>{formatRound(probe?.round ?? null)}</dd>
        </div>
        <div>
          <dt style={{ color: "#6B7280", fontSize: "0.75rem" }}>Latency</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{formatLatency(probe?.latencyMs ?? null)}</dd>
        </div>
        <div>
          <dt style={{ color: "#6B7280", fontSize: "0.75rem" }}>Last probe</dt>
          <dd style={{ margin: 0 }}>{formatTime(probe?.at ?? null)}</dd>
        </div>
        <div>
          <dt style={{ color: "#6B7280", fontSize: "0.75rem" }}>Request OK</dt>
          <dd style={{ margin: 0 }}>{probe ? (probe.ok ? "Yes" : "No") : "—"}</dd>
        </div>
      </dl>

      <p style={{ margin: 0, color: "#4B5563", fontSize: "0.85rem" }}>
        {details ?? "No additional information available."}
      </p>
    </article>
  );
}

export default function Status(): JSX.Element {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [lastUpdatedIso, setLastUpdatedIso] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const requestRef = useRef<{ controller: AbortController; id: number } | null>(null);
  const requestIdCounter = useRef(0);

  const fetchSummary = useCallback(async () => {
    const controller = new AbortController();
    const requestId = requestIdCounter.current++;

    const previous = requestRef.current;
    if (previous) {
      previous.controller.abort();
    }

    requestRef.current = { controller, id: requestId };
    setIsLoading(true);
    setError(null);

    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch("/api/health", {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText || "Request failed");
      }

      const data = (await response.json()) as HealthSummary;

      if (requestRef.current?.id === requestId) {
        setSummary(data);
        setLastUpdatedIso(new Date().toISOString());
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (requestRef.current?.id !== requestId) {
        return;
      }
      if (isAbort) {
        setError("Request timed out. Please try again.");
      } else {
        const message =
          err instanceof Error && err.message ? err.message : "Failed to load status";
        setError(message);
      }
    } finally {
      clearTimeout(timeoutId);
      if (requestRef.current?.id === requestId) {
        requestRef.current = null;
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
    return () => {
      if (requestRef.current) {
        requestRef.current.controller.abort();
      }
    };
  }, [fetchSummary]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void fetchSummary();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchSummary]);

  const overallStatus: OverallStatus | null = useMemo(
    () => (summary ? computeOverallStatus(summary) : null),
    [summary]
  );

  const handleRefresh = useCallback(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefresh((current) => {
      const next = !current;
      if (next) {
        void fetchSummary();
      }
      return next;
    });
  }, [fetchSummary]);

  const consistencyPill = summary ? (
    <Pill
      label={pillLabel(summary.consistency)}
      tone={toneForConsistency(summary.consistency)}
    />
  ) : null;

  return (
    <main
      style={{
        padding: "1.5rem 0",
        maxWidth: 960,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem"
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem"
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem"
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.75rem" }}>Network Status</h1>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.85rem",
                color: "#374151"
              }}
            >
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={handleToggleAutoRefresh}
              />
              Auto-refresh (15s)
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 8,
                border: "1px solid #111827",
                background: isLoading ? "#F9FAFB" : "#111827",
                color: isLoading ? "#111827" : "#fff",
                cursor: isLoading ? "wait" : "pointer",
                fontWeight: 600
              }}
            >
              {isLoading ? "Refreshing..." : "Refresh now"}
            </button>
          </div>
        </div>
        <div style={{ color: "#6B7280", fontSize: "0.85rem" }}>
          Last updated: {formatTime(lastUpdatedIso)}
        </div>
        {error ? (
          <div
            role="alert"
            style={{
              background: "#FEF2F2",
              color: "#B91C1C",
              border: "1px solid #FCA5A5",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              fontSize: "0.9rem"
            }}
          >
            {error}
          </div>
        ) : null}
      </header>

      <section
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          padding: "1.25rem",
          background: "#F9FAFB",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem"
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span style={{ fontSize: "1rem", fontWeight: 600 }}>Overall</span>
          {overallStatus ? <Pill label={pillLabel(overallStatus)} tone={toneForStatus(overallStatus)} /> : null}
        </div>
        {summary ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>Network</div>
              <div style={{ fontWeight: 600 }}>{summary.network}</div>
            </div>
            <div style={{ minWidth: 160 }}>
              <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>Consistency</div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {consistencyPill}
                <span style={{ fontSize: "0.85rem", color: "#374151" }}>
                  {summary.consistency === "OK"
                    ? "Indexer within tolerance"
                    : summary.consistency === "WARN"
                      ? "Indexer lag exceeds target"
                      : "One or more probes failed"}
                </span>
              </div>
            </div>
            <div style={{ minWidth: 160 }}>
              <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>Round gap</div>
              <div style={{ fontWeight: 600 }}>
                {typeof summary.roundGap === "number" ? summary.roundGap : "—"}
              </div>
              <div style={{ color: "#6B7280", fontSize: "0.75rem" }}>
                algod − indexer
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: "#6B7280", fontSize: "0.9rem" }}>
            Status information will appear once the first probe completes.
          </div>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.25rem"
        }}
      >
        <ServiceCard title="Algod" network={summary?.network ?? "—"} probe={summary?.algod ?? null} />
        <ServiceCard title="Indexer" network={summary?.network ?? "—"} probe={summary?.indexer ?? null} />
      </section>
    </main>
  );
}

