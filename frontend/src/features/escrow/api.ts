export type EscrowStatus = "not_configured" | "needs_funding" | "ready" | "unknown";

export const MIN_READY_MICROALGOS = 1_000_000n;

const env = import.meta.env;

export function getEscrowAddress(): string | null {
  const value = (env?.VITE_BANK_ESCROW_ADDR ?? "").trim();
  return value.length > 0 ? value : null;
}

function getIndexerBaseUrl(): string {
  const url = (env?.VITE_INDEXER_URL ?? "").trim();
  if (!url) {
    throw new Error("Indexer URL not configured");
  }
  return url.replace(/\/+$/, "");
}

export async function getEscrowBalance(addr: string): Promise<bigint> {
  const baseUrl = getIndexerBaseUrl();
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = (env?.VITE_INDEXER_TOKEN ?? "").trim();
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const response = await fetch(`${baseUrl}/v2/accounts/${addr}`, { headers });
  if (!response.ok) {
    throw new Error(`Indexer responded with status ${response.status}`);
  }

  const data = await response.json();
  const amount = data?.account?.amount;
  if (typeof amount === "number") {
    return BigInt(amount);
  }
  if (typeof amount === "string" && amount.trim().length > 0) {
    return BigInt(amount);
  }
  return 0n;
}

export function formatAlgos(microAlgos: bigint): string {
  const algos = Number(microAlgos) / 1_000_000;
  return algos.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function networkExplorerUrl(addr: string): string | null {
  const network = (env?.VITE_NETWORK ?? "testnet").toString().toLowerCase();
  if (network === "mainnet") {
    return `https://algoexplorer.io/address/${addr}`;
  }
  if (network === "testnet") {
    return `https://testnet.algoexplorer.io/address/${addr}`;
  }
  return null; // localnet or unknown
}
