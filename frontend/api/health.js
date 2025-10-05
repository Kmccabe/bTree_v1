// frontend/api/health.js
// HealthSummary with live Algod + live Indexer probes (fallback when /health is 404)

const HEALTH_TIMEOUT_MS = 5000;
const INDEXER_LAG_OK = 2;

// -------- env helpers (no Node types) --------
const env = (globalThis.process && globalThis.process.env) || Object.create(null);
const firstEnv = (keys) =>
  keys.map((k) => env[k]).find((v) => typeof v === "string" && v.trim() !== "") || null;

const network = (() => {
  const raw = String(env.VITE_ALGOD_NETWORK || env.ALGOD_NETWORK || "").toLowerCase();
  return raw.startsWith("main") ? "mainnet" : raw.startsWith("local") ? "localnet" : "testnet";
})();

const nowIso = () => new Date().toISOString();
const down = (label, reason) => ({
  ok: false, status: "DOWN", latencyMs: null, round: null,
  details: `${label} ${reason}`, at: nowIso()
});

const parseRound = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const errorMessage = (err) => {
  if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
    return "request timed out";
  }
  return String(err && err.message ? err.message : err || "request failed");
};

// -------- resolve bases / headers (key-agnostic) --------
const resolveAlgodBase = () =>
  firstEnv([
    "ALGOD_URL",
    "TESTNET_ALGOD_URL",
    "VITE_TESTNET_ALGOD_URL",
    "MAINNET_ALGOD_URL",
    "LOCALNET_ALGOD_URL",
  ]);

const resolveIndexerBase = () =>
  firstEnv([
    "INDEXER_URL",
    "TESTNET_INDEXER_URL",
    "VITE_TESTNET_INDEXER_URL",
    "MAINNET_INDEXER_URL",
    "LOCALNET_INDEXER_URL",
  ]);

const resolveAlgodHeaders = () => {
  const token =
    firstEnv([
      "ALGOD_TOKEN",
      "TESTNET_ALGOD_TOKEN",
      "VITE_TESTNET_ALGOD_TOKEN",
      "MAINNET_ALGOD_TOKEN",
      "LOCALNET_ALGOD_TOKEN",
    ]) || null;

  const headerName =
    firstEnv([
      "ALGOD_TOKEN_HEADER",
      "TESTNET_ALGOD_TOKEN_HEADER",
      "MAINNET_ALGOD_TOKEN_HEADER",
      "LOCALNET_ALGOD_TOKEN_HEADER",
    ]) || "X-API-Key";

  const h = { Accept: "application/json" };
  if (token) h[headerName] = token;
  return h;
};

const resolveIndexerHeaders = () => {
  const token =
    firstEnv([
      "INDEXER_TOKEN",
      "TESTNET_INDEXER_TOKEN",
      "VITE_TESTNET_INDEXER_TOKEN",
      "MAINNET_INDEXER_TOKEN",
      "LOCALNET_INDEXER_TOKEN",
    ]) || null;

  const headerName =
    firstEnv([
      "INDEXER_TOKEN_HEADER",
      "TESTNET_INDEXER_TOKEN_HEADER",
      "MAINNET_INDEXER_TOKEN_HEADER",
      "LOCALNET_INDEXER_TOKEN_HEADER",
    ]) || "X-API-Key";

  const h = { Accept: "application/json" };
  if (token) h[headerName] = token;
  return h;
};

// -------- probes --------
async function probeAlgod(baseUrl, headers) {
  if (!baseUrl) return down("Algod", "base URL missing");

  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/v2/status`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const started = Date.now();

  try {
    const resp = await fetch(url, { method: "GET", headers, signal: controller.signal });
    const latency = Date.now() - started;
    const body = await resp.text().catch(() => "");

    if (!resp.ok) {
      clearTimeout(t);
      const snippet = body ? body.slice(0, 400) : resp.statusText;
      return down("Algod", `HTTP ${resp.status}${snippet ? `: ${snippet}` : ""}`);
    }

    let parsed;
    try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = null; }
    clearTimeout(t);

    if (parsed === null) {
      return { ok: false, status: "DEGRADED", latencyMs: latency, round: null, details: "Algod returned non-JSON response", at: nowIso() };
    }

    const round = parseRound(parsed["last-round"] ?? parsed["lastRound"]);
    let status = "OK";
    let details;

    if (round === null) {
      status = "DEGRADED";
      details = "missing last-round";
    }

    const catchingUp =
      (typeof parsed["catching-up"] === "boolean" && parsed["catching-up"]) ||
      (typeof parsed["catchup"] === "boolean" && parsed["catchup"]);
    const catchupTime = parseRound(parsed["catchup-time"]);

    if (catchingUp || (catchupTime !== null && catchupTime > 0)) {
      status = "DEGRADED";
      details = (details ? details + "; " : "") +
        (catchingUp ? "node catching up" : "") +
        (catchupTime !== null ? `${catchingUp ? "; " : ""}catchup-time ${catchupTime}` : "");
    }

    if (typeof parsed["message"] === "string" && parsed["message"].trim()) {
      details = (details ? details + "; " : "") + parsed["message"].trim();
    }

    return { ok: true, status, latencyMs: latency, round, details, at: nowIso() };
  } catch (err) {
    clearTimeout(t);
    return down("Algod", errorMessage(err));
  }
}

function roundFromHeaders(resp) {
  const hdrs = resp.headers;
  const pick = (k) => {
    const v = hdrs.get(k);
    const n = parseRound(v);
    return n;
  };
  return pick("x-algo-indexer-round") ?? pick("x-indexer-round") ?? null;
}

async function probeIndexer(baseUrl, headers) {
  if (!baseUrl) return down("Indexer", "base URL missing");

  const base = baseUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const started = Date.now();

  try {
    // 1) Try /health
    const healthUrl = `${base}/health`;
    const resp = await fetch(healthUrl, { method: "GET", headers, signal: controller.signal });
    const latency = Date.now() - started;

    // If /health not found, 2) fallback to a cheap endpoint to extract round
    if (resp.status === 404) {
      const txUrl = `${base}/v2/transactions?limit=1`;
      const r2 = await fetch(txUrl, { method: "GET", headers, signal: controller.signal });
      const text2 = await r2.text().catch(() => "");
      const done = Date.now();

      if (!r2.ok) {
        clearTimeout(t);
        const snippet = text2 ? text2.slice(0, 400) : r2.statusText;
        return down("Indexer", `HTTP ${r2.status}${snippet ? `: ${snippet}` : ""}`);
      }

      let parsed2;
      try { parsed2 = text2 ? JSON.parse(text2) : {}; } catch { parsed2 = null; }
      clearTimeout(t);

      if (parsed2 === null) {
        return { ok: false, status: "DEGRADED", latencyMs: done - started, round: null, details: "Indexer fallback returned non-JSON response", at: nowIso() };
      }

      const round = (parseRound(parsed2["current-round"]) ?? parseRound(parsed2["currentRound"])) ?? roundFromHeaders(r2);
      let status = "OK";
      let details = "Used fallback /v2/transactions";

      if (round === null) {
        status = "DEGRADED";
        details += "; missing current-round";
      }

      return { ok: true, status, latencyMs: done - started, round, details, at: nowIso() };
    }

    const text = await resp.text().catch(() => "");
    const done = Date.now();

    if (!resp.ok) {
      clearTimeout(t);
      const snippet = text ? text.slice(0, 400) : resp.statusText;
      return down("Indexer", `HTTP ${resp.status}${snippet ? `: ${snippet}` : ""}`);
    }

    let parsed;
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = null; }
    clearTimeout(t);

    if (parsed === null) {
      return { ok: false, status: "DEGRADED", latencyMs: done - started, round: null, details: "Indexer returned non-JSON response", at: nowIso() };
    }

    // Prefer body fields; fall back to headers for round
    const round = (parseRound(parsed["current-round"]) ?? parseRound(parsed["round"]) ?? parseRound(parsed["currentRound"])) ?? roundFromHeaders(resp);

    let status = "OK";
    let details;

    if (round === null) {
      status = "DEGRADED";
      details = "missing current-round";
    }
    if (typeof parsed["is-degraded"] === "boolean" && parsed["is-degraded"]) {
      status = "DEGRADED";
      details = details ? details + "; " + "Indexer reports degraded" : "Indexer reports degraded";
    }
    if (typeof parsed["message"] === "string" && parsed["message"].trim()) {
      details = details ? details + "; " + parsed["message"].trim() : parsed["message"].trim();
    }

    return { ok: true, status, latencyMs: done - started, round, details, at: nowIso() };
  } catch (err) {
    clearTimeout(t);
    return down("Indexer", errorMessage(err));
  }
}

// -------- handler --------
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET,HEAD");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (req.method === "HEAD") return res.status(200).end();

  const algodBase = resolveAlgodBase();
  const indexerBase = resolveIndexerBase();
  const algodHeaders = resolveAlgodHeaders();
  const indexerHeaders = resolveIndexerHeaders();

  const [algod, indexer] = await Promise.all([
    probeAlgod(algodBase, algodHeaders),
    probeIndexer(indexerBase, indexerHeaders),
  ]);

  let roundGap = null;
  if (typeof algod.round === "number" && typeof indexer.round === "number") {
    roundGap = algod.round - indexer.round;
  }

  let consistency = "OK";
  if (algod.status === "DOWN" || indexer.status === "DOWN") consistency = "FAIL";
  else if (roundGap !== null && roundGap > INDEXER_LAG_OK) consistency = "WARN";

  return res.status(200).json({ network, algod, indexer, consistency, roundGap });
}
