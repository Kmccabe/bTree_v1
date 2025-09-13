import React from 'react';
import { WalletProvider as TxnlabWalletProvider, WalletManager, SupportedWallet, WalletId } from '@txnlab/use-wallet-react';
import { getEnvNetwork } from './config';

/**
 * Configure which wallets to offer based on network.
 * Adjust this list later (e.g., add Defly/KMD) as needed.
 */
function buildSupportedWallets(): SupportedWallet[] {
  const wallets: SupportedWallet[] = [{ id: WalletId.PERA }];
  const projectId = (import.meta as any).env?.VITE_WC_PROJECT_ID || (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID;
  // Only enable WalletConnect when a projectId is provided to avoid runtime errors
  if (projectId && typeof projectId === 'string') {
    wallets.push({ id: WalletId.WALLETCONNECT, options: { projectId } } as SupportedWallet);
  }
  // Example adds later:
  // wallets.push({ id: WalletId.DEFLY });
  // wallets.push({ id: WalletId.KMD });
  return wallets;
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
    <TxnlabWalletProvider manager={manager}>
      {children}
    </TxnlabWalletProvider>
  );
}
