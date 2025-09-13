export type Network = 'localnet' | 'testnet' | 'mainnet';

export function getEnvNetwork(): Network {
  const raw = (import.meta as any).env?.VITE_ALGOD_NETWORK ?? 'testnet';
  const v = String(raw).toLowerCase();
  if (v === 'localnet' || v === 'testnet' || v === 'mainnet') return v;
  return 'testnet';
}

