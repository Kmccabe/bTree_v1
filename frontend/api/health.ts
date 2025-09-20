import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { algodHeaders, algodUrl } from "./_algod.js";

export const HEALTH_TIMEOUT_MS = 5000;
export const INDEXER_LAG_OK = 2;
export const AUTO_REFRESH_MS_DEFAULT = 15000;

export type ServiceKind = "algod" | "indexer";

export interface ProbeResult {
  ok: boolean;
  status: "OK" | "DEGRADED" | "DOWN";
  latencyMs: number | null;
  round: number | null;
  details?: string;
  at: string;
}

export interface HealthSummary {
  network: "testnet" | "mainnet" | "localnet";
  algod: ProbeResult;
  indexer: ProbeResult;
  consistency: "OK" | "WARN" | "FAIL";
  roundGap: number | null;
}

interface IndexerConfig {
  baseUrl: string;
  headers: Record<string, string>;
}

const INDEXER_ROUND_HEADERS = ["x-algo-indexer-round", "x-indexer-round"];

function firstEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function joinUrl(base: string, path: string) {
  const normalizedBase = base.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function serviceLabel(kind: ServiceKind): string {
  return kind === "algod" ? "Algod" : "Indexer";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return "request timed out";
    }
    return err.message || "request failed";
  }
  return "request failed";
}

function parseJson(text: string): Record<string, unknown> | null {
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseRound(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return null;
}

function extractRound(
  data: Record<string, unknown> | null | undefined,
  keys: string[]
): number | null {
  if (!data) return null;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const round = parseRound((data as Record<string, unknown>)[key]);
      if (round !== null) return round;
    }
  }
  return null;
}

function roundFromHeaders(response: Response): number | null {
  for (const key of INDEXER_ROUND_HEADERS) {
    const raw = response.headers.get(key);
    const round = parseRound(raw);
    if (round !== null) {
      return round;
    }
  }
  return null;
}

function appendDetail(existing: string | undefined, addition: string): string {
  if (existing && existing.includes(addition)) {
    return existing;
  }
  return existing ? `${existing}; ${addition}` : addition;
}

function getNetwork(): "testnet" | "mainnet" | "localnet" {
  const raw = firstEnv(["VITE_ALGOD_NETWORK", "ALGOD_NETWORK"])?.toLowerCase();
  if (raw === "mainnet" || raw === "localnet") {
    return raw;
  }
  return "testnet";
}

function getIndexerConfig(): IndexerConfig {
  const base = firstEnv([
    "INDEXER_URL",
    "TESTNET_INDEXER_URL",
    "VITE_TESTNET_INDEXER_URL"
  ]);
  if (!base) {
    throw new Error(
      "INDEXER_URL (or TESTNET_INDEXER_URL / VITE_TESTNET_INDEXER_URL) env not set on server"
    );
  }
  const headers: Record<string, string> = {
    Accept: "application/json"
  };
  const token = firstEnv([
    "INDEXER_TOKEN",
    "TESTNET_INDEXER_TOKEN",
    "VITE_TESTNET_INDEXER_TOKEN"
  ]);
  if (token) {
    const tokenHeader =
      firstEnv(["INDEXER_TOKEN_HEADER", "TESTNET_INDEXER_TOKEN_HEADER"]) ||
      "X-API-Key";
    headers[tokenHeader] = token;
  }
  return {
    baseUrl: base.replace(/\/$/, ""),
    headers
  };
}

function downResult(kind: ServiceKind, reason: string): ProbeResult {
  return {
    ok: false,
    status: "DOWN",
    latencyMs: null,
    round: null,
    details: `${serviceLabel(kind)} ${reason}`,
    at: nowIso()
  };
}

export async function probeAlgod(): Promise<ProbeResult> {
  const url = algodUrl("/v2/status");
  const headers = algodHeaders();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const snippet = bodyText ? bodyText.slice(0, 400) : response.statusText;
      return downResult(
        "algod",
        `HTTP ${response.status}${snippet ? `: ${snippet}` : ""}`
      );
    }

    const text = await response.text();
    const parsed = parseJson(text);
    const completed = Date.now();

    if (parsed === null) {
      return {
        ok: false,
        status: "DEGRADED",
        latencyMs: completed - started,
        round: null,
        details: "Algod returned non-JSON response",
        at: new Date(completed).toISOString()
      };
    }

    const round = extractRound(parsed, ["last-round", "lastRound"]);
    let status: "OK" | "DEGRADED" = "OK";
    let details: string | undefined;

    if (round === null) {
      status = "DEGRADED";
      details = appendDetail(details, "missing last-round");
    }

    const catchingUp =
      (typeof parsed["catching-up"] === "boolean" && parsed["catching-up"]) ||
      (typeof parsed["catchup"] === "boolean" && parsed["catchup"]);
    const catchupTime = parseRound(parsed["catchup-time"]);

    if (catchingUp || (catchupTime !== null && catchupTime > 0)) {
      status = "DEGRADED";
      if (catchingUp) {
        details = appendDetail(details, "node catching up");
      }
      if (catchupTime !== null) {
        details = appendDetail(details, `catchup-time ${catchupTime}`);
      }
    }

    if (typeof parsed["message"] === "string" && parsed["message"].trim()) {
      details = appendDetail(details, parsed["message"].trim());
    }

    return {
      ok: true,
      status,
      latencyMs: completed - started,
      round,
      details,
      at: new Date(completed).toISOString()
    };
  } catch (err) {
    return downResult("algod", errorMessage(err));
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function probeIndexer(): Promise<ProbeResult> {
  const { baseUrl, headers } = getIndexerConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const started = Date.now();

  try {
    const healthResponse = await fetch(joinUrl(baseUrl, "/health"), {
      method: "GET",
      headers,
      signal: controller.signal
    });

    if (healthResponse.status === 404) {
      const fallbackResponse = await fetch(
        joinUrl(baseUrl, "/v2/transactions?limit=1"),
        {
          method: "GET",
          headers,
          signal: controller.signal
        }
      );

      const fallbackText = await fallbackResponse.text();
      const completed = Date.now();

      if (!fallbackResponse.ok) {
        const snippet = fallbackText
          ? fallbackText.slice(0, 400)
          : fallbackResponse.statusText;
        return downResult(
          "indexer",
          `HTTP ${fallbackResponse.status}${snippet ? `: ${snippet}` : ""}`
        );
      }

      const parsed = parseJson(fallbackText);
      if (parsed === null) {
        return {
          ok: false,
          status: "DEGRADED",
          latencyMs: completed - started,
          round: null,
          details: "Indexer fallback returned non-JSON response",
          at: new Date(completed).toISOString()
        };
      }

      const round =
        extractRound(parsed, ["current-round", "currentRound"]) ??
        roundFromHeaders(fallbackResponse);

      let status: "OK" | "DEGRADED" = "OK";
      let details: string | undefined = "Used fallback /v2/transactions";

      if (round === null) {
        status = "DEGRADED";
        details = appendDetail(details, "missing current-round");
      }

      return {
        ok: true,
        status,
        latencyMs: completed - started,
        round,
        details,
        at: new Date(completed).toISOString()
      };
    }

    const bodyText = await healthResponse.text();
    const completed = Date.now();

    if (!healthResponse.ok) {
      const snippet = bodyText ? bodyText.slice(0, 400) : healthResponse.statusText;
      return downResult(
        "indexer",
        `HTTP ${healthResponse.status}${snippet ? `: ${snippet}` : ""}`
      );
    }

    const parsed = parseJson(bodyText);
    if (parsed === null) {
      return {
        ok: false,
        status: "DEGRADED",
        latencyMs: completed - started,
        round: null,
        details: "Indexer returned non-JSON response",
        at: new Date(completed).toISOString()
      };
    }

    const round =
      extractRound(parsed, ["current-round", "round", "currentRound"]) ??
      roundFromHeaders(healthResponse);
    let status: "OK" | "DEGRADED" = "OK";
    let details: string | undefined;

    if (round === null) {
      status = "DEGRADED";
      details = appendDetail(details, "missing current-round");
    }

    if (
      typeof parsed["is-degraded"] === "boolean" &&
      parsed["is-degraded"]
    ) {
      status = "DEGRADED";
      details = appendDetail(details, "Indexer reports degraded");
    }

    if (typeof parsed["message"] === "string" && parsed["message"].trim()) {
      details = appendDetail(details, parsed["message"].trim());
    }

    return {
      ok: true,
      status,
      latencyMs: completed - started,
      round,
      details,
      at: new Date(completed).toISOString()
    };
  } catch (err) {
    return downResult("indexer", errorMessage(err));
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getHealthSummary(): Promise<HealthSummary> {
  const [algod, rawIndexer] = await Promise.all([probeAlgod(), probeIndexer()]);

  let roundGap: number | null = null;
  if (typeof algod.round === "number" && typeof rawIndexer.round === "number") {
    roundGap = algod.round - rawIndexer.round;
  }

  let consistency: "OK" | "WARN" | "FAIL";
  if (algod.status === "DOWN" || rawIndexer.status === "DOWN") {
    consistency = "FAIL";
  } else if (roundGap !== null && roundGap > INDEXER_LAG_OK) {
    consistency = "WARN";
  } else {
    consistency = "OK";
  }

  let indexer = rawIndexer;
  if (consistency === "WARN") {
    const addition =
      roundGap !== null
        ? `Indexer lagging by ${roundGap} round${roundGap === 1 ? "" : "s"}`
        : "Indexer lag exceeds acceptable threshold";
    indexer =
      rawIndexer.status === "OK"
        ? {
            ...rawIndexer,
            status: "DEGRADED",
            details: appendDetail(rawIndexer.details, addition)
          }
        : {
            ...rawIndexer,
            details: appendDetail(rawIndexer.details, addition)
          };
  }

  return {
    network: getNetwork(),
    algod,
    indexer,
    consistency,
    roundGap
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET,HEAD");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const summary = await getHealthSummary();
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "HEAD") {
      return res.status(200).end();
    }
    return res.status(200).json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "health check failed";
    return res.status(500).json({ error: message });
  }
}
