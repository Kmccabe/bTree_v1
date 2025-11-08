import { useEffect, useState } from 'react';
import algosdk from 'algosdk';

export type AccountFreshness = 'unknown' | 'new' | 'used' | 'error';

export function useAccountFreshness(address?: string): {
  freshness: AccountFreshness;
  isChecking: boolean;
} {
  const [freshness, setFreshness] = useState<AccountFreshness>('unknown');
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      if (!address) {
        setFreshness('unknown');
        setIsChecking(false);
        return;
      }

      const INDEXER_URL =
        (import.meta.env.VITE_INDEXER_URL as string | undefined) ||
        'https://testnet-idx.algonode.cloud';
      const INDEXER_TOKEN =
        (import.meta.env.VITE_INDEXER_TOKEN as string | undefined) || '';
      const client = new algosdk.Indexer(INDEXER_TOKEN, INDEXER_URL, '');

      try {
        setIsChecking(true);

        const txns = await client.lookupAccountTransactions(address).limit(1).do();
        if (cancelled) return;
        if (Array.isArray(txns?.transactions) && txns.transactions.length > 0) {
          setFreshness('used');
          return;
        }

        const acct = await client.lookupAccountByID(address).do();
        if (cancelled) return;
        const data = acct?.account as unknown as Record<string, unknown> | undefined;
        if (data) {
          const appState = data['apps-local-state'];
          const assetsState = data['assets'];
          const createdAssetsState = data['created-assets'];
          const amountValue = data['amount'];

          const apps = Array.isArray(appState) ? appState.length : 0;
          const assets = Array.isArray(assetsState) ? assetsState.length : 0;
          const createdAssets = Array.isArray(createdAssetsState) ? createdAssetsState.length : 0;
          const amount = typeof amountValue === 'number' ? amountValue : 0;

          const hasApps = apps > 0;
          const assetsCount = assets + createdAssets;
          const funded = amount > 100_000;
          if (hasApps || assetsCount > 0 || funded) {
            setFreshness('used');
          } else {
            setFreshness('new');
          }
        } else {
          setFreshness('error');
        }
      } catch (err: any) {
        const status = err?.response?.status ?? err?.status ?? err?.code ?? 0;
        const msg = String(err?.message || '').toLowerCase();
        if (status === 404 || msg.includes('no accounts found')) {
          if (!cancelled) setFreshness('new');
        } else {
          console.error('[bTree] useAccountFreshness error', err);
          if (!cancelled) setFreshness('error');
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { freshness, isChecking };
}
