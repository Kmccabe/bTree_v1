// frontend/api/health.js
// HealthSummary with a real Algod probe (Indexer's still stubbed)

const HEALTH_TIMEOUT_MS = 5000;
const INDEXER_LAG_OK = 2;

// Safe env access without Node types
const env = (globalThis.process && globalThis.process.env) || {};
const firstEnv = (keys) =>
  keys.map((k) => env[k]).find((v) => typeof v === "string" && v.trim() !== "") || null;

const normalizeNet = () => {
  const raw = String(env.VITE_ALGOD_NETWORK || env.ALGOD_NETWORK || "").toLowerCase();
  return raw.startsWith("main") ? "mainnet" : raw.startsWith("local") ? "localnet" : "testnet";
};

const buildHeaders = () => {
  // Prefer TESTNET_* / MAINNET_* based on VITE_ALGOD_NETWORK, else generic
  const net = normalizeNet();
  const tkn =
    (net === "mainnet"  && firstEnv(["MAINNET_ALGOD_TOKEN", "ALGOD_TOKEN"])) ||
    (net === "localnet" && firstEnv(["LOCALNET_ALGOD_TOKEN", "ALGOD_TOKEN"])) ||
    (/* testnet */        firstEnv(["TESTNET_ALGOD_TOKEN", "ALGOD_TOKEN"])) ||
    null;

  const hdr =
    (net === "mainnet"  && firstEnv(["MAINNET_ALGOD_TOKEN_HEADER", "ALGOD_TOKEN_HEADER"])) ||
    (net === "localnet" && firstEnv(["LOCALNET_ALGOD_TOKEN_HEADER", "ALGOD_TOKEN_HEADER"])) ||
    (/* testnet */        firstEnv(["TESTNET_ALGOD_TOKEN_HEADER", "ALGOD_TOKEN_HEADER"])) ||
    "X-API-Key";

  const h = { Accept: "application/json" };
  if (tkn) h[hdr] = tkn;
  return h;
};

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
    const msg = err && typeof err === "object" && "name" in err && err.name === "AbortError"
      ? "request timed out"
      : String(err && err.message ? err.message : err || "request failed");
    return down("Algod", msg);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET,HEAD");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (req.method === "HEAD") return res.status(200).end();

  const network = normalizeNet();

  // Resolve bases (generic or network-scoped)
  const algodBase =
    (network === "mainnet"  && firstEnv(["MAINNET_ALGOD_URL", "ALGOD_URL"])) ||
    (network === "localnet" && firstEnv(["LOCALNET_ALGOD_URL", "ALGOD_URL"])) ||
    (/* testnet */            firstEnv(["TESTNET_ALGOD_URL", "ALGOD_URL"])) ||
    null;

  const indexerBase =
    (network === "mainnet"  && firstEnv(["MAINNET_INDEXER_URL", "INDEXER_URL"])) ||
    (network === "localnet" && firstEnv(["LOCALNET_INDEXER_URL", "INDEXER_URL"])) ||
    (/* testnet */            firstEnv(["TESTNET_INDEXER_URL", "INDEXER_URL"])) ||
    null;

  // Real probe for Algod; Indexer remains a stub for now
  const headers = buildHeaders();
  const algod = await probeAlgod(algodBase, headers);
  const indexer = {
    ok: !!indexerBase,
    status: indexerBase ? "OK" : "DEGRADED",
    latencyMs: null,
    round: null,
    details: indexerBase ? `base=${indexerBase}` : "Indexer base URL missing",
    at: nowIso()
  };

  // Consistency & round gap
  let roundGap = null;
  if (typeof algod.round === "number" && typeof indexer.round === "number") {
    roundGap = algod.round - indexer.round;
  }
  let consistency = "OK";
  if (algod.status === "DOWN" || indexer.status === "DOWN") consistency = "FAIL";
  else if (roundGap !== null && roundGap > INDEXER_LAG_OK) consistency = "WARN";

  return res.status(200).json({ network, algod, indexer, consistency, roundGap });
}
