import React from 'react';
import { NavLink } from 'react-router-dom';
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
  const classicUrl =
    (import.meta as any).env?.VITE_CLASSIC_URL as string | undefined;
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
        <h1 style={{ fontSize: '2.75rem', lineHeight: 1.1, margin: 0 }}>bTree — Trust Game</h1>
        <p style={{ marginTop: '0.75rem', fontSize: '1.125rem', maxWidth: 720 }}>
          Run and participate in on-chain trust-game experiments. This v2 site provides
          a clean, professional interface; the current wallet flow runs on the classic app (v1).
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          {/* Primary CTA — internal navigation */}
          <NavLink
            to="/subject"
            style={primaryActionStyle}
          >
            Join as Subject
          </NavLink>

          {/* Secondary CTA — open classic/v1 for experimenter */}
          {classicUrl ? (
            <a
              href={classicUrl}
              target="_blank"
              rel="noreferrer"
              style={secondaryActionStyle}
            >
              Run an Experiment (v1)
            </a>
          ) : (
            <span style={{ alignSelf: 'center', color: '#6b7280' }}>
              (Set <code>VITE_CLASSIC_URL</code> to enable the v1 link)
            </span>
          )}
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
            Would you like to be a subject?
          </h2>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Connect your Algorand wallet to opt into the bTree registry and join upcoming trust-game sessions.
          </p>
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
            Welcome to bTree
          </h2>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.6 }}>
            We run verifiable economic experiments on Algorand. If you need a wallet, follow our quick-start guide to install and fund one in minutes.
          </p>
          <a
            href={walletGuideUrl}
            target="_blank"
            rel="noopener"
            style={secondaryActionStyle}
          >
            Get Wallet
          </a>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#4b5563' }}>
            The guide covers Pera Wallet setup for TestNet and links to additional resources.
          </p>
        </article>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" style={{ fontSize: '1.5rem', margin: 0, marginBottom: '0.75rem' }}>
          How it works
        </h2>
        <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'grid', gap: '0.5rem', maxWidth: 820 }}>
          <li>
            <strong>Connect &amp; join</strong> — Subjects join an open session and register (opt-in).
          </li>
          <li>
            <strong>Play</strong> — S1 invests <code>s</code>; S2 returns <code>r</code> with rules enforced on-chain.
          </li>
          <li>
            <strong>Results</strong> — The app logs events and payouts; CSV export supports analysis.
          </li>
        </ol>

        <p style={{ marginTop: '0.75rem', color: '#4b5563' }}>
          Today, wallet flows run on the classic app (v1). As v2 matures, those actions will move here.
        </p>
      </section>
    </main>
  );
}
