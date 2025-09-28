// frontend/api/health.ts
// Minimal, crash-proof handler (no external imports, no Node types)

// Local request/response types so we don't depend on @vercel/node
type VercelRequest = { method?: string; query?: Record<string, any> };
type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: any): void;
  end(): void;
};

// Access env safely without referencing `process` directly
const env = ((globalThis as any).process?.env ?? {}) as Record<
  string,
  string | undefined
>;

function firstEnv(keys: string[]): string | undefined {
  for (const k of keys) {
    const v = env[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}

function getNetwork(): "testnet" | "mainnet" | "localnet" {
  const raw = (firstEnv(["VITE_ALGOD_NETWORK", "ALGOD_NETWORK"]) || "")
    .toLowerCase();
  if (raw.startsWith("main")) return "mainnet";
  if (raw.startsWith("local")) return "localnet";
  return "testnet";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET,HEAD");
    return res.status(405).json({ error: "method not allowed" });
  }

  const net = getNetwork();
  const algodBase =
    firstEnv(["ALGOD_URL", "TESTNET_ALGOD_URL", "VITE_TESTNET_ALGOD_URL"]) ??
    null;
  const indexerBase =
    firstEnv(["INDEXER_URL", "TESTNET_INDEXER_URL", "VITE_TESTNET_INDEXER_URL"]) ??
    null;

  res.setHeader("Cache-Control", "no-store");
  if (req.method === "HEAD") return res.status(200).end();
  return res.status(200).json({
    ok: true,
    net,
    algodBase,
    indexerBase,
    at: new Date().toISOString(),
  });
}
