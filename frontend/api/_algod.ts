
export function algodHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.TESTNET_ALGOD_TOKEN || "";
  if (token) headers["X-API-Key"] = token;
  return headers;
}

export function algodUrl(path: string) {
  const base = process.env.TESTNET_ALGOD_URL;
  if (!base) throw new Error("TESTNET_ALGOD_URL env not set on server");
  return base.replace(/\/$/, "") + path;
}
