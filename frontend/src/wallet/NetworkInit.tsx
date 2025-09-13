import React from 'react';
import { useNetwork } from '@txnlab/use-wallet-react';

export default function NetworkInit({ network }: { network: 'localnet' | 'testnet' | 'mainnet' }): JSX.Element {
  const { setActiveNetwork, updateAlgodConfig } = useNetwork();
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // Map env to Algod URLs if provided; otherwise rely on library defaults.
    const env = (import.meta as any).env || {};
    const upper = network.toUpperCase();
    const baseUrl = env[`VITE_${upper}_ALGOD_URL`] || env[`${upper}_ALGOD_URL`];
    const token = env[`VITE_${upper}_ALGOD_TOKEN`] || env[`${upper}_ALGOD_TOKEN`] || '';
    const port = env[`VITE_${upper}_ALGOD_PORT`] || env[`${upper}_ALGOD_PORT`] || '';

    (async () => {
      try {
        await setActiveNetwork(network);
        if (baseUrl) {
          updateAlgodConfig(network, { baseServer: baseUrl, port, token });
        }
        // Helpful debug (remove later if noisy)
        try {
          console.debug('[NetworkInit] Active network set:', network, 'Algod:', baseUrl || '(default)');
        } catch {}
      } catch (e) {
        console.warn('NetworkInit: failed to set network', e);
      }
    })();
    // Intentionally run once on mount to avoid loops when hooks change identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
