import React from 'react';
import { WalletProvider as TxnlabWalletProvider, WalletManager, SupportedWallet, WalletId } from '@txnlab/use-wallet-react';
import { getEnvNetwork } from './config';

/**
 * Configure which wallets to offer based on network.
 * Adjust this list later (e.g., add Defly/KMD) as needed.
 */
function buildSupportedWallets(): SupportedWallet[] {
  // Minimal set: Pera + WalletConnect group
  return [
    { id: WalletId.PERA },
    { id: WalletId.WALLETCONNECT }
    // Example adds:
    // { id: WalletId.DEFLY },
    // { id: WalletId.KMD },
  ];
}

export default function WalletProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const network = getEnvNetwork();
  const manager = React.useMemo(() => {
    return new WalletManager({
      wallets: buildSupportedWallets(),
      // Some versions of the lib infer network from client config; keeping explicit here is harmless
      network
    });
  }, [network]);

  return (
    <TxnlabWalletProvider value={manager}>
      {children}
    </TxnlabWalletProvider>
  );
}

