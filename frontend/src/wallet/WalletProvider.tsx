import React from 'react';
import {
  WalletProvider as ReactWalletProvider,
  WalletManager,
  WalletId,
  NetworkConfigBuilder,
  NetworkId,
} from '@txnlab/use-wallet-react';
import { getEnvNetwork } from './config';

function getWCProjectId(): string | null {
  const v = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function caipFromEnv(envNet: 'localnet' | 'testnet' | 'mainnet'): string {
  return `algorand:${envNet}`;
}

function resolveDefaultNetwork(envNet: 'localnet' | 'testnet' | 'mainnet'): string {
  switch (envNet) {
    case 'mainnet': return NetworkId.MAINNET;
    case 'localnet': return 'localnet';
    default: return NetworkId.TESTNET;
  }
}

function buildNetworks(envNet: 'localnet' | 'testnet' | 'mainnet') {
  const testnetUrl =
    (import.meta as any).env?.VITE_TESTNET_ALGOD_URL ??
    (import.meta as any).env?.VITE_ALGOD_URL ??
    'https://testnet-api.algonode.cloud';
  const mainnetUrl =
    (import.meta as any).env?.VITE_MAINNET_ALGOD_URL ??
    'https://mainnet-api.algonode.cloud';
  const localUrl =
    (import.meta as any).env?.VITE_LOCALNET_ALGOD_URL ?? 'http://localhost';
  const localPort =
    (import.meta as any).env?.VITE_LOCALNET_ALGOD_PORT ?? '4001';
  const localToken =
    (import.meta as any).env?.VITE_LOCALNET_ALGOD_TOKEN ??
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  const builder = new NetworkConfigBuilder();

  builder.testnet({
    algod: { baseServer: testnetUrl, port: '443', token: '' },
    // Hard-pin CAIP chain id for WalletConnect
    caipChainId: 'algorand:testnet',
  });

  builder.mainnet({
    algod: { baseServer: mainnetUrl, port: '443', token: '' },
    caipChainId: 'algorand:mainnet',
  });

  builder.localnet({
    algod: { baseServer: localUrl, port: String(localPort), token: String(localToken) },
    caipChainId: 'algorand:localnet',
  });

  return builder.build();
}

export default function WalletProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const envNet = getEnvNetwork(); // 'localnet' | 'testnet' | 'mainnet'
  const defaultNetwork = resolveDefaultNetwork(envNet);
  const networks = buildNetworks(envNet);
  const projectId = getWCProjectId();
  const caip = caipFromEnv(envNet);

  const manager = React.useMemo(() => {
    return new WalletManager({
      wallets: [
        WalletId.PERA,
        ...(projectId ? [{ id: WalletId.WALLETCONNECT, options: { projectId } } as const] : []),
      ],
      networks,
      defaultNetwork,
    });
  }, [defaultNetwork, networks, projectId]);

  React.useEffect(() => {
    // Debug what we pass
    console.log('[WalletProvider] defaultNetwork:', defaultNetwork, 'CAIP:', caip);
  }, [defaultNetwork, caip]);

  return <ReactWalletProvider manager={manager}>{children}</ReactWalletProvider>;
}
import React from 'react';
import {
  WalletProvider as ReactWalletProvider,
  WalletManager,
  WalletId,
  NetworkConfigBuilder,
  NetworkId,
} from '@txnlab/use-wallet-react';
import { getEnvNetwork } from './config';

function getWCProjectId(): string | null {
  const v = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

type EnvNet = 'localnet' | 'testnet' | 'mainnet';

function resolveDefaultNetwork(envNet: EnvNet): string {
  switch (envNet) {
    case 'mainnet': return NetworkId.MAINNET;
    case 'localnet': return 'localnet';
    default: return NetworkId.TESTNET;
  }
}

// Build explicit networks and **hard-pin CAIP chain IDs** to avoid WC defaulting to mainnet
function buildNetworks() {
  const testnetUrl =
    (import.meta as any).env?.VITE_TESTNET_ALGOD_URL ??
    (import.meta as any).env?.VITE_ALGOD_URL ??
    'https://testnet-api.algonode.cloud';
  const mainnetUrl =
    (import.meta as any).env?.VITE_MAINNET_ALGOD_URL ??
    'https://mainnet-api.algonode.cloud';
  const localUrl =
    (import.meta as any).env?.VITE_LOCALNET_ALGOD_URL ?? 'http://localhost';
  const localPort =
    (import.meta as any).env?.VITE_LOCALNET_ALGOD_PORT ?? '4001';
  const localToken =
    (import.meta as any).env?.VITE_LOCALNET_ALGOD_TOKEN ??
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  const b = new NetworkConfigBuilder();

  b.testnet({
    algod: { baseServer: testnetUrl, port: '443', token: '' },
    caipChainId: 'algorand:testnet',
  });

  b.mainnet({
    algod: { baseServer: mainnetUrl, port: '443', token: '' },
    caipChainId: 'algorand:mainnet',
  });

  b.localnet({
    algod: { baseServer: localUrl, port: String(localPort), token: String(localToken) },
    caipChainId: 'algorand:localnet',
  });

  return b.build();
}

export default function WalletProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const envNet = getEnvNetwork() as EnvNet; // 'localnet' | 'testnet' | 'mainnet'
  const defaultNetwork = resolveDefaultNetwork(envNet);
  const networks = buildNetworks();
  const projectId = getWCProjectId();

  const manager = React.useMemo(() => {
    return new WalletManager({
      wallets: [
        WalletId.PERA,
        ...(projectId ? [{ id: WalletId.WALLETCONNECT, options: { projectId } } as const] : []),
        // Add others later: WalletId.DEFLY, WalletId.EXODUS, WalletId.KMD, etc.
      ],
      networks,
      defaultNetwork,
      options: {
        // Helpful when switching between testnet/mainnet during dev
        resetNetwork: true,
      },
    });
  }, [defaultNetwork, networks, projectId]);

  // Debug: confirm what the lib believes we are on
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[WalletProvider] defaultNetwork:', defaultNetwork);
  }, [defaultNetwork]);

  // v4 provider prop is `manager`
  return <ReactWalletProvider manager={manager}>{children}</ReactWalletProvider>;
}
