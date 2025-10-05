/// <reference types="node" />

const DEFAULT_TOKEN_HEADER = "X-API-Key";

function firstEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

export function algodHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(extra ?? {})
  };

  const token = firstEnv([
    "ALGOD_TOKEN",
    "TESTNET_ALGOD_TOKEN",
    "VITE_TESTNET_ALGOD_TOKEN"
  ]);

  const tokenHeader =
    firstEnv(["ALGOD_TOKEN_HEADER", "TESTNET_ALGOD_TOKEN_HEADER"]) ||
    DEFAULT_TOKEN_HEADER;

  if (token) headers[tokenHeader] = token;
  return headers;
}

export function algodUrl(path?: string) {
  const base = firstEnv([
    "ALGOD_URL",
    "TESTNET_ALGOD_URL",
    "VITE_TESTNET_ALGOD_URL"
  ]);

  if (!base) {
    throw new Error(
      "ALGOD_URL (or TESTNET_ALGOD_URL / VITE_TESTNET_ALGOD_URL) env not set on server"
    );
  }

  // changed: remove one-or-more trailing slashes (was /\/$/)
  const normalizedBase = base.replace(/\/+$/, "");
  // changed: tolerate undefined path (no .startsWith on undefined)
  const normalizedPath = !path ? "" : (path.startsWith("/") ? path : `/${path}`);
  return `${normalizedBase}${normalizedPath}`;
}
