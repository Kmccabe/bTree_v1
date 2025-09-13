export type Network = 'localnet' | 'testnet' | 'mainnet';

export function getEnvNetwork(): Network {
  const raw = (import.meta as any).env?.VITE_ALGOD_NETWORK ?? 'testnet';
  if (raw === 'localnet' || raw === 'testnet' || raw === 'mainnet') return raw;
  return 'testnet';
}

