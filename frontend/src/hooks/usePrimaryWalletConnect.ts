import { useCallback, useMemo, useState } from 'react';
import { PROVIDER_ID, useWallet } from '@txnlab/use-wallet';

type ConnectState = {
  handleConnect: () => Promise<void>;
  isConnecting: boolean;
  preferredName?: string;
};

export function usePrimaryWalletConnect(): ConnectState {
  const { providers, clients } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);

  const peraProvider = useMemo(
    () => providers?.find((provider) => provider.metadata.id === PROVIDER_ID.PERA),
    [providers]
  );

  const preferredProvider = useMemo(
    () => peraProvider ?? providers?.[0] ?? null,
    [peraProvider, providers]
  );

  const preferredName =
    preferredProvider?.metadata?.name ?? preferredProvider?.metadata?.id ?? undefined;

  const handleConnect = useCallback(async () => {
    const target = preferredProvider;
    const peraClient = clients?.[PROVIDER_ID.PERA];

    if (!target) {
      console.warn('Wallet provider not initialized yet');
      return;
    }

    setIsConnecting(true);
    try {
      await target.connect();
      if (!target.isActive) target.setActiveProvider?.();
    } catch (err: any) {
      const msg = String(err?.message || err).toLowerCase();
      if (msg.includes('currently connected') && peraClient) {
        try {
          await peraClient.reconnect(() => {});
          if (!target.isActive) target.setActiveProvider?.();
        } catch (e) {
          console.error('Reconnect failed:', e);
        }
      } else {
        console.error('Connect failed:', err);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [clients, preferredProvider]);

  return { handleConnect, isConnecting, preferredName };
}
