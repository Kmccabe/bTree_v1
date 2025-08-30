import { PeraWalletConnect } from "@perawallet/connect";

// Export a single shared Pera instance so session state is consistent app-wide
export const pera = new PeraWalletConnect();

// Optional helper to ensure a session is restored when needed
export async function ensurePeraSession(): Promise<string[] | null> {
  try {
    const accts = await pera.reconnectSession();
    return accts && accts.length ? accts : null;
  } catch {
    return null;
  }
}

