import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { PROVIDER_ID, useWallet } from '@txnlab/use-wallet';

const walletGuideUrl = 'https://www.canva.com/design/DAGmIGnFLIQ/2wxMPSMRW1d4Gj87W9pRVA/view?utm_content=DAGmIGnFLIQ&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hf388731d15#1';

function shortAddress(address?: string | null): string {
  if (!address) return '';
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatNetworkLabel(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes('mainnet')) return 'MainNet';
  if (normalized.includes('testnet')) return 'TestNet';
  if (normalized.includes('betanet')) return 'BetaNet';
  if (normalized.includes('sandbox')) return 'Sandbox';
  if (normalized.includes('local')) return 'LocalNet';
  return value;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '1.5rem',
  background: '#ffffff',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
};

const primaryActionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.6rem 1rem',
  border: '1px solid #111827',
  borderRadius: 8,
  background: '#111827',
  color: '#ffffff',
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer'
};

const secondaryActionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.6rem 1rem',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  background: '#f9fafb',
  color: '#111827',
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer'
};

export default function Landing(): JSX.Element {
  const {
    activeAddress,
    activeAccount,
    connectedAccounts,
    providers,
    clients,
  } = useWallet();

  const peraProvider = useMemo(
    () => providers?.find((p) => p.metadata.id === PROVIDER_ID.PERA),
    [providers]
  );

  const activeProvider = useMemo(
    () => providers?.find((provider) => provider.isActive) ?? null,
    [providers]
  );

  const primaryProvider = useMemo(
    () => activeProvider ?? peraProvider ?? providers?.[0] ?? null,
    [activeProvider, peraProvider, providers]
  );

  const providerId = primaryProvider?.metadata?.id;

  const networkLabel = useMemo(() => {
    const providerNetwork = (
      primaryProvider as unknown as { network?: string } | undefined
    )?.network;

    const providerClient =
      providerId && clients ? (clients[providerId] as unknown) : undefined;

    const clientNetwork =
      (providerClient as { network?: string } | undefined)?.network ??
      (providerClient as { genesisID?: string } | undefined)?.genesisID ??
      (providerClient as { genesisId?: string } | undefined)?.genesisId ??
      (providerClient as { genesisHash?: string } | undefined)?.genesisHash;

    const envFallback =
      (import.meta as any)?.env?.VITE_NETWORK as string | undefined;

    const inferred =
      providerNetwork ??
      (typeof clientNetwork === 'string' ? clientNetwork : undefined) ??
      envFallback;

    return formatNetworkLabel(inferred);
  }, [clients, primaryProvider, providerId]);

  const address = useMemo(() => {
    if (activeAddress) return activeAddress;
    if (activeAccount?.address) return activeAccount.address;
    if (connectedAccounts.length > 0) return connectedAccounts[0].address;
    return null;
  }, [activeAccount, activeAddress, connectedAccounts]);

  const statusLine = useMemo(() => {
    if (!address) return null;
    const suffix = networkLabel ? ` (${networkLabel})` : '';
    return `Connected as ${shortAddress(address)}${suffix}`;
  }, [address, networkLabel]);

  const handleConnect = useCallback(async () => {
    const target = peraProvider ?? providers?.[0];
    const peraClient = clients?.[PROVIDER_ID.PERA];
    if (!target) {
      console.warn('Wallet provider not initialized yet');
      return;
    }
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
    }
  }, [clients, peraProvider, providers]);

  return (
    <main style={{ padding: '2rem 0' }}>
      {/* Hero */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.75rem', lineHeight: 1.1, margin: 0 }}>Welcome to bTree</h1>
        <p className="mt-4 max-w-3xl text-base md:text-lg text-gray-700 dark:text-gray-200 leading-relaxed text-center md:text-left mx-auto md:mx-0">
          bTree is a decentralized research platform where you can earn money by participating in transparent, verifiable economic and social science experiments. Every decision you make advances scientific understanding, while you build your own on-chain behavioral profile and reputation. Join bTree today to help shape the future of research, earn money, and become part of a global community of trusted subjects.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <Link
            to="/about"
            style={secondaryActionStyle}
          >
            What is bTree?
          </Link>
        </div>
      </section>

      <section
        aria-label="Wallet onboarding"
        style={{
          display: 'grid',
          gap: '1.5rem',
          marginBottom: '2.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
        }}
      >
        <article style={cardStyle}>
          <h2 style={{ fontSize: '1.35rem', margin: 0 }}>
            Sign-up or Sign-in
          </h2>
          <button
            type="button"
            onClick={handleConnect}
            style={primaryActionStyle}
          >
            Connect Wallet
          </button>
          {statusLine && (
            <p style={{ margin: 0, marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              {statusLine}
            </p>
          )}
          <p style={{ margin: 0, marginTop: '0.75rem', fontSize: '0.85rem', color: '#4b5563' }}>
            Ready to continue? Visit the{' '}
            <NavLink to="/subject/register" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>
              subject registration
            </NavLink>{' '}
            page.
          </p>
        </article>

        <article style={cardStyle}>
          <h2 style={{ fontSize: '1.35rem', margin: 0 }}>
            Get your wallet here
          </h2>
          <a
            href={walletGuideUrl}
            target="_blank"
            rel="noopener"
            style={secondaryActionStyle}
          >
            Get Wallet
          </a>
        </article>
      </section>

    </main>
  );
}
