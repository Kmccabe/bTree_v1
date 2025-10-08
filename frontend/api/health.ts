import type { VercelRequest, VercelResponse } from "@vercel/node";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

type ProbeStatus = "OK" | "DEGRADED" | "DOWN";
type Consistency = "OK" | "WARN" | "FAIL";

type ProbeResult = {
  ok: boolean;
  status: ProbeStatus;
  latencyMs: number | null;
  round: number | null;
  details?: string;
  at: string;
};

type HealthSummary = {
  network: "mainnet" | "testnet" | "localnet";
  algod: ProbeResult;
  indexer: ProbeResult;
  consistency: Consistency;
  roundGap: number | null;
};

type SimpleHeaders = { get(name: string): string | null };

type SimpleResponse = {
  status: number;
  statusText: string;
  headers: SimpleHeaders;
  text(): Promise<string>;
};

const HEALTH_TIMEOUT_MS = 5000;
const INDEXER_LAG_OK = 2;

const env = (globalThis.process && globalThis.process.env) || Object.create(null);

const firstEnv = (keys: readonly string[]): string | null =>
  keys
    .map((k) => env[k])
    .find((value) => typeof value === "string" && value.trim() !== "")
  ?? null;

const network = (() => {
  const raw = String(env.VITE_ALGOD_NETWORK || env.ALGOD_NETWORK || "").toLowerCase();
  if (raw.startsWith("main")) return "mainnet" as const;
  if (raw.startsWith("local")) return "localnet" as const;
  return "testnet" as const;
})();

const nowIso = () => new Date().toISOString();

const down = (label: string, reason: string): ProbeResult => ({
  ok: false,
  status: "DOWN",
  latencyMs: null,
  round: null,
  details: `${label} ${reason}`,
  at: nowIso(),
});

const parseRound = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const errorMessage = (err: unknown): string => {
  if (err && typeof err === "object" && "name" in err && (err as { name?: string }).name === "AbortError") {
    return "request timed out";
  }
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? "request failed");
  }
  return String(err ?? "request failed");
};

const resolveAlgodBase = () =>
  firstEnv([
    "ALGOD_URL",
    "TESTNET_ALGOD_URL",
    "VITE_TESTNET_ALGOD_URL",
    "MAINNET_ALGOD_URL",
    "LOCALNET_ALGOD_URL",
  ] as const);

const resolveIndexerBase = () =>
  firstEnv([
    "INDEXER_URL",
    "TESTNET_INDEXER_URL",
    "VITE_TESTNET_INDEXER_URL",
    "MAINNET_INDEXER_URL",
    "LOCALNET_INDEXER_URL",
  ] as const);

const resolveAlgodHeaders = () => {
  const token =
    firstEnv([
      "ALGOD_TOKEN",
      "TESTNET_ALGOD_TOKEN",
      "VITE_TESTNET_ALGOD_TOKEN",
      "MAINNET_ALGOD_TOKEN",
      "LOCALNET_ALGOD_TOKEN",
    ] as const) ?? null;

  const headerName =
    firstEnv([
      "ALGOD_TOKEN_HEADER",
      "TESTNET_ALGOD_TOKEN_HEADER",
      "MAINNET_ALGOD_TOKEN_HEADER",
      "LOCALNET_ALGOD_TOKEN_HEADER",
    ] as const) ?? "X-API-Key";

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers[headerName] = token;
  return headers;
};

const resolveIndexerHeaders = () => {
  const token =
    firstEnv([
      "INDEXER_TOKEN",
      "TESTNET_INDEXER_TOKEN",
      "VITE_TESTNET_INDEXER_TOKEN",
      "MAINNET_INDEXER_TOKEN",
      "LOCALNET_INDEXER_TOKEN",
    ] as const) ?? null;

  const headerName =
    firstEnv([
      "INDEXER_TOKEN_HEADER",
      "TESTNET_INDEXER_TOKEN_HEADER",
      "MAINNET_INDEXER_TOKEN_HEADER",
      "LOCALNET_INDEXER_TOKEN_HEADER",
    ] as const) ?? "X-API-Key";

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers[headerName] = token;
  return headers;
};

const roundFromHeaders = (resp: SimpleResponse): number | null => {
  const headerKeys = ["x-algo-indexer-round", "x-indexer-round"] as const;
  for (const key of headerKeys) {
    const value = resp.headers.get(key);
    const round = parseRound(value);
    if (round !== null) return round;
  }
  return null;
};

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const httpFetch = (urlStr: string, options: FetchOptions = {}): Promise<SimpleResponse> =>
  new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const lib = url.protocol === "https:" ? https : http;
      const requestOptions: http.RequestOptions = {
        method: options.method ?? "GET",
        headers: options.headers,
      };

      let settled = false;
      let abortListener: (() => void) | undefined;

      const cleanup = () => {
        if (options.signal && abortListener) {
          options.signal.removeEventListener("abort", abortListener);
        }
      };

      const req = lib.request(url, requestOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        res.on("error", (err) => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(err);
          }
        });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          cleanup();
          const body = Buffer.concat(chunks).toString("utf8");
          const headers: SimpleHeaders = {
            get(name: string) {
              const value = res.headers[name.toLowerCase()];
              if (Array.isArray(value)) return value[0] ?? null;
              return typeof value === "string" ? value : null;
            },
          };
          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            headers,
            async text() {
              return body;
            },
          });
        });
      });

      req.on("error", (err) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(err);
        }
      });

      if (options.signal) {
        const abortError = new Error("AbortError");
        abortError.name = "AbortError";
        abortListener = () => {
          if (settled) return;
          settled = true;
          cleanup();
          req.destroy(abortError);
          reject(abortError);
        };
        if (options.signal.aborted) {
          abortListener();
          return;
        }
        options.signal.addEventListener("abort", abortListener, { once: true });
      }

      req.end();
    } catch (err) {
      reject(err);
    }
  });

async function probeAlgod(baseUrl: string | null, headers: Record<string, string>): Promise<ProbeResult> {
  if (!baseUrl) return down("Algod", "base URL missing");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const started = Date.now();

  try {
    const resp = await httpFetch(`${baseUrl.replace(/\/+$/, "")}/v2/status`, {
      headers,
      signal: controller.signal,
    });
    const latency = Date.now() - started;
    const text = await resp.text().catch(() => "");

    if (resp.status < 200 || resp.status >= 300) {
      const snippet = text ? text.slice(0, 400) : resp.statusText;
      return down("Algod", `HTTP ${resp.status}${snippet ? `: ${snippet}` : ""}`);
    }

    let parsed: any = {};
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = null; }
    }

    if (!parsed) {
      return { ok: false, status: "DEGRADED", latencyMs: latency, round: null, details: "Algod returned non-JSON", at: nowIso() };
    }

    const round = parseRound(parsed["last-round"] ?? parsed["round"] ?? parsed["lastRound"]);
    const status: ProbeStatus = parsed.catchup ? "DEGRADED" : "OK";
    const details = typeof parsed.message === "string" ? parsed.message : parsed.catchup ? "Algod reported catchup" : undefined;

    return { ok: true, status, latencyMs: latency, round, details, at: nowIso() };
  } catch (err) {
    return down("Algod", errorMessage(err));
  } finally {
    clearTimeout(timeout);
  }
}

async function probeIndexer(baseUrl: string | null, headers: Record<string, string>): Promise<ProbeResult> {
  if (!baseUrl) return down("Indexer", "base URL missing");

  const base = baseUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const started = Date.now();

  try {
    const mainResp = await httpFetch(`${base}/health`, { headers, signal: controller.signal });
    const latency = Date.now() - started;

    if (mainResp.status === 404) {
      const fallback = await httpFetch(`${base}/v2/transactions?limit=1`, { headers, signal: controller.signal });
      const text = await fallback.text().catch(() => "");
      const done = Date.now();

      if (fallback.status < 200 || fallback.status >= 300) {
        const snippet = text ? text.slice(0, 400) : fallback.statusText;
        return down("Indexer", `HTTP ${fallback.status}${snippet ? `: ${snippet}` : ""}`);
      }

      let parsed: any = {};
      if (text) {
        try { parsed = JSON.parse(text); } catch { parsed = null; }
      }

      if (!parsed) {
        return { ok: false, status: "DEGRADED", latencyMs: done - started, round: null, details: "Indexer fallback returned non-JSON", at: nowIso() };
      }

      const round = parseRound(parsed["current-round"]) ?? parseRound(parsed["currentRound"]) ?? roundFromHeaders(fallback);
      const status: ProbeStatus = round === null ? "DEGRADED" : "OK";
      const details = round === null ? "missing current-round" : "Used fallback /v2/transactions";
      return { ok: true, status, latencyMs: done - started, round, details, at: nowIso() };
    }

    const text = await mainResp.text().catch(() => "");
    const done = Date.now();

    if (mainResp.status < 200 || mainResp.status >= 300) {
      const snippet = text ? text.slice(0, 400) : mainResp.statusText;
      return down("Indexer", `HTTP ${mainResp.status}${snippet ? `: ${snippet}` : ""}`);
    }

    let parsed: any = {};
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = null; }
    }

    if (!parsed) {
      return { ok: false, status: "DEGRADED", latencyMs: done - started, round: null, details: "Indexer returned non-JSON response", at: nowIso() };
    }

    const round =
      parseRound(parsed["current-round"]) ??
      parseRound(parsed["round"]) ??
      parseRound(parsed["currentRound"]) ??
      roundFromHeaders(mainResp);

    let status: ProbeStatus = "OK";
    const detailMessages: string[] = [];
    if (round === null) {
      status = "DEGRADED";
      detailMessages.push("missing current-round");
    }
    if (typeof parsed["is-degraded"] === "boolean" && parsed["is-degraded"]) {
      status = "DEGRADED";
      detailMessages.push("Indexer reports degraded");
    }
    if (typeof parsed["message"] === "string" && parsed["message"].trim()) {
      detailMessages.push(parsed["message"].trim());
    }

    return {
      ok: true,
      status,
      latencyMs: done - started,
      round,
      details: detailMessages.length ? detailMessages.join("; ") : undefined,
      at: nowIso(),
    };
  } catch (err) {
    return down("Indexer", errorMessage(err));
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET,HEAD");
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }

  const algodBase = resolveAlgodBase();
  const indexerBase = resolveIndexerBase();

  const [algod, indexer] = await Promise.all([
    probeAlgod(algodBase, resolveAlgodHeaders()),
    probeIndexer(indexerBase, resolveIndexerHeaders()),
  ]);

  let roundGap: number | null = null;
  if (typeof algod.round === "number" && typeof indexer.round === "number") {
    roundGap = algod.round - indexer.round;
  }

  let consistency: Consistency = "OK";
  if (algod.status === "DOWN" || indexer.status === "DOWN") {
    consistency = "FAIL";
  } else if (roundGap !== null && roundGap > INDEXER_LAG_OK) {
    consistency = "WARN";
  }

  const payload: HealthSummary = {
    network,
    algod,
    indexer,
    consistency,
    roundGap,
  };

  res.status(200).json(payload);
}
