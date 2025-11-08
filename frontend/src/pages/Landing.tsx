import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PROVIDER_ID, useWallet } from '@txnlab/use-wallet';
import algosdk from 'algosdk';
import { usePrimaryWalletConnect } from '../hooks/usePrimaryWalletConnect';

const walletGuideUrl = 'https://www.canva.com/design/DAGmIGnFLIQ/2wxMPSMRW1d4Gj87W9pRVA/view?utm_content=DAGmIGnFLIQ&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hf388731d15#1';
const ALGOD_URL = (import.meta.env.VITE_ALGOD_URL as string | undefined) || 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = (import.meta.env.VITE_ALGOD_TOKEN as string | undefined) || '';
const REGISTRY_APP_ID = Number(import.meta.env.VITE_REGISTRY_APP_ID);
const encoder = new TextEncoder();

const addrBytes = (addr: string): Uint8Array => algosdk.decodeAddress(addr).publicKey;
const bnProfile = (addr: string): Uint8Array =>
  new Uint8Array([...encoder.encode('profile:'), ...addrBytes(addr)]);

type RegStatus = 'idle' | 'checking' | 'registered' | 'not_registered' | 'error';

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

const landingPaths = new Set<string>(['/', '/home']);

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
  const algod = useMemo(() => new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, ''), []);
  const [regStatus, setRegStatus] = useState<RegStatus>('idle');

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

  useEffect(() => {
    if (!address) {
      setRegStatus('idle');
      return;
    }
    if (!Number.isFinite(REGISTRY_APP_ID) || REGISTRY_APP_ID <= 0) {
      console.error('REGISTRY_APP_ID invalid:', import.meta.env.VITE_REGISTRY_APP_ID);
      setRegStatus('error');
      return;
    }

    let alive = true;
    (async () => {
      setRegStatus('checking');
      const boxName = bnProfile(address);
      console.debug('[bTree] registry check', { ALGOD_URL, REGISTRY_APP_ID, address });
      try {
        await algod.getApplicationBoxByName(REGISTRY_APP_ID, boxName).do();
        if (alive) setRegStatus('registered');
      } catch (err: any) {
        const status = err?.response?.status ?? err?.status ?? err?.code;
        const msg = String(err?.message || '').toLowerCase();
        if (status === 404 || /not found|box does not exist/.test(msg)) {
          if (alive) setRegStatus('not_registered');
        } else {
          console.error('[bTree] registry check failed', { status, msg, err });
          if (alive) setRegStatus('error');
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [address, algod]);

  const registrationCopy =
    !address || regStatus === 'idle'
      ? null
      : regStatus === 'checking'
      ? 'Checking registration...'
      : regStatus === 'registered'
      ? 'account is registered'
      : regStatus === 'not_registered'
      ? 'account is not registered'
      : 'could not verify registration';

  const { handleConnect, isConnecting } = usePrimaryWalletConnect();

  const navigate = useNavigate();
  const location = useLocation();
  const lastNav = useRef<{ addr?: string; status?: 'registered' | 'not_registered' } | null>(null);

  useEffect(() => {
    if (!landingPaths.has(location.pathname)) return;

    const hasSkipFlag =
      !!location.state &&
      typeof location.state === 'object' &&
      (location.state as { skipLandingRedirect?: boolean }).skipLandingRedirect;

    if (hasSkipFlag) {
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    if (!address) return;
    if (regStatus !== 'registered' && regStatus !== 'not_registered') return;

    if (lastNav.current?.addr === address && lastNav.current?.status === regStatus) return;

    const target = regStatus === 'registered' ? '/subject/dashboard' : '/subject/signup';
    lastNav.current = { addr: address, status: regStatus };
    navigate(target, { replace: true });
  }, [address, regStatus, location.pathname, location.state, navigate]);

  return (
    <main style={{ padding: '2rem 0' }}>
      {/* Hero */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.75rem', lineHeight: 1.1, margin: 0 }}>Welcome to bTree</h1>
        <p className="mt-4 max-w-3xl text-base md:text-lg text-gray-700 dark:text-gray-200 leading-relaxed text-center md:text-left mx-auto md:mx-0">
          bTree connects researchers with citizen scientists to run economics experiments on the Algorand blockchain.
          As a citizen scientist you can participate in experiments and earn money with the knowledge that every
          decision you make helps advance our scientific understanding of the world.  At the same time you build
          your own on-chain behavioral profile and scientific reputation.
        </p>
        <p className="mt-4 max-w-3xl text-base md:text-lg text-gray-700 dark:text-gray-200 leading-relaxed text-center md:text-left mx-auto md:mx-0">
          If you already joined WELCOME BACK.  Connect your wallet account to go to your Citizen Scientist Dashboard.
        </p>
        <p className="mt-3 max-w-3xl text-base md:text-lg text-gray-700 dark:text-gray-200 leading-relaxed text-center md:text-left mx-auto md:mx-0">
          If you want to be a citizen scientist, join bTree today and help shape the future of research, earn money, and become part of a global community.
          To start you must connect your wallet account. This is how you will make decisions on the blockchain and building your reputation.  If you don't
          have a wallet you can get a trusted wallet below.
        </p>
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
            disabled={isConnecting}
            style={{
              ...primaryActionStyle,
              opacity: isConnecting ? 0.7 : 1,
              cursor: isConnecting ? 'not-allowed' : 'pointer'
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
          {statusLine && (
            <p style={{ margin: 0, marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
              {statusLine}
            </p>
          )}
          {registrationCopy && (
            <p style={{ margin: 0, marginTop: '0.4rem', fontSize: '0.8rem', color: '#374151' }}>
              {registrationCopy}
            </p>
          )}

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
