export type Network = 'localnet' | 'testnet' | 'mainnet';

export function getEnvNetwork(): Network {
  const env = (import.meta as any).env || {};
  const raw = env.VITE_ALGOD_NETWORK;
  if (raw === 'localnet' || raw === 'testnet' || raw === 'mainnet') return raw;
  // Fallback to legacy VITE_NETWORK
  const upper = String(env.VITE_NETWORK || '').toUpperCase();
  if (upper === 'MAINNET') return 'mainnet';
  if (upper === 'LOCALNET') return 'localnet';
  return 'testnet';
}
