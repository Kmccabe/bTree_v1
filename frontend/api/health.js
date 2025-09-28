// frontend/api/health.js
// Return HealthSummary shape so the Status page doesn't crash

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET,HEAD");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (req.method === "HEAD") return res.status(200).end();

  // Safe env access (no TS/node types here)
  const env = (globalThis.process && globalThis.process.env) || {};
  const firstEnv = (keys) =>
    keys.map((k) => env[k]).find((v) => typeof v === "string" && v.trim() !== "") || null;

  const netRaw = String(env.VITE_ALGOD_NETWORK || env.ALGOD_NETWORK || "").toLowerCase();
  const network = netRaw.startsWith("main")
    ? "mainnet"
    : netRaw.startsWith("local")
    ? "localnet"
    : "testnet";

  const now = new Date().toISOString();
  const algodBase = firstEnv(["ALGOD_URL", "TESTNET_ALGOD_URL", "VITE_TESTNET_ALGOD_URL"]);
  const indexerBase = firstEnv(["INDEXER_URL", "TESTNET_INDEXER_URL", "VITE_TESTNET_INDEXER_URL"]);

  // Build ProbeResult stubs so UI has .status, .round, etc.
  const mkProbe = (label, base) => ({
    ok: !!base,
    status: base ? "OK" : "DEGRADED",
    latencyMs: null,
    round: null,
    details: base ? `base=${base}` : `${label} base URL missing`,
    at: now
  });

  const algod = mkProbe("Algod", algodBase);
  const indexer = mkProbe("Indexer", indexerBase);

  // Overall consistency placeholder logic
  let consistency = "OK";
  if (algod.status !== "OK" || indexer.status !== "OK") consistency = "WARN";

  const roundGap = null;

  // Return HealthSummary (what Status.tsx expects)
  return res.status(200).json({
    network,
    algod,
    indexer,
    consistency,
    roundGap
  });
}
