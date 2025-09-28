// frontend/api/health.js
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // allow only GET/HEAD
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET,HEAD");
    return res.status(405).json({ error: "method not allowed" });
    }

  // safe env access (no Node types)
  const env = (globalThis.process && globalThis.process.env) || {};
  const firstEnv = (keys) =>
    keys.map((k) => env[k]).find((v) => typeof v === "string" && v.trim() !== "") || null;

  const netRaw = String(env.VITE_ALGOD_NETWORK || env.ALGOD_NETWORK || "").toLowerCase();
  const net = netRaw.startsWith("main") ? "mainnet" : netRaw.startsWith("local") ? "localnet" : "testnet";

  if (req.method === "HEAD") return res.status(200).end();

  return res.status(200).json({
    ok: true,
    net,
    algodBase: firstEnv(["ALGOD_URL", "TESTNET_ALGOD_URL", "VITE_TESTNET_ALGOD_URL"]),
    indexerBase: firstEnv(["INDEXER_URL", "TESTNET_INDEXER_URL", "VITE_TESTNET_INDEXER_URL"]),
    at: new Date().toISOString(),
  });
}
