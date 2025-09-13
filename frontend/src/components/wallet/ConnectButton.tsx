import React from 'react';
import { useWallet } from '@txnlab/use-wallet-react';

function truncate(addr: string, left = 6, right = 4): string {
  if (!addr) return '';
  return addr.length <= left + right ? addr : `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

function envCAIP(): string {
  const raw = (import.meta as any).env?.VITE_ALGOD_NETWORK ?? 'testnet';
  const n = String(raw).toLowerCase();
  if (n === 'mainnet' || n === 'testnet' || n === 'localnet') return `algorand:${n}`;
  return 'algorand:testnet';
}

export default function ConnectButton(): JSX.Element {
  const { wallets, activeAddress, activeWallet } = useWallet();
  const [open, setOpen] = React.useState(false);
  const caip = envCAIP();

  // Disconnected: show "Connect wallet" and a simple wallet picker menu
  if (!activeAddress) {
    return (
      <div style={{ position: 'relative' }}>
        <button type="button" onClick={() => setOpen(v => !v)} style={btnStyle}>
          Connect wallet
        </button>
        {open && (
          <div style={menuStyle}>
            {(() => {
              const hasWC = Boolean((import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID);
              const visibleWallets = (wallets as any[]).filter((w: any) => {
                const id = String(w?.id || '').toUpperCase();
                const isWC = id === 'WALLETCONNECT';
                return isWC ? hasWC : true;
              });
              return visibleWallets.map((w: any) => (
              <button
                key={w.id}
                type="button"
                style={menuItemStyle}
                onClick={async () => {
                  try {
                    const isWC = String(w?.id || '').toUpperCase() === 'WALLETCONNECT';
                    const accounts = isWC ? await w.connect({ chain: caip }) : await w.connect();
                    try { w.setActive?.(); } catch {}
                  } catch (e) {
                    console.error('wallet connect error', e);
                  } finally {
                    setOpen(false);
                  }
                }}
              >
                {(() => {
                  const id = String(w?.id || '').toUpperCase();
                  return id === 'WALLETCONNECT' ? 'WalletConnect (QR)' : (w?.metadata?.name ?? String(w.id));
                })()}
              </button>
              ));
            })()}
          </div>
        )}
      </div>
    );
  }

  // Connected: show truncated address with a Disconnect action
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={btnStyle}>
        {truncate(activeAddress)}
      </button>
      {open && (
        <div style={menuStyle}>
          <button
            type="button"
            style={menuItemStyle}
            onClick={async () => {
              try {
                await activeWallet?.disconnect();
              } finally {
                setOpen(false);
              }
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#f9fafb',
  cursor: 'pointer',
  minWidth: 160,
  textAlign: 'center'
};

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
  minWidth: 200,
  zIndex: 30
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer'
};
import React from 'react';
import { useWallet } from '@txnlab/use-wallet-react';

function truncate(addr: string, left = 6, right = 4): string {
  if (!addr) return '';
  return addr.length <= left + right ? addr : `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

function envCAIP(): string {
  const raw = (import.meta as any).env?.VITE_ALGOD_NETWORK ?? 'testnet';
  const n = String(raw).toLowerCase();
  if (n === 'mainnet' || n === 'testnet' || n === 'localnet') return `algorand:${n}`;
  return 'algorand:testnet';
}

export default function ConnectButton(): JSX.Element {
  const { wallets, activeAddress, connect, disconnect } = useWallet();
  const [open, setOpen] = React.useState(false);

  const hasWC = Boolean((import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID);
  const visibleWallets = (wallets as any[]).filter((w: any) =>
    (w?.id === 'walletconnect' || w?.id === 'WALLETCONNECT') ? hasWC : true
  );

  if (!activeAddress) {
    const caip = envCAIP();
    return (
      <div style={{ position: 'relative' }}>
        <button type="button" onClick={() => setOpen(v => !v)} style={btnStyle}>
          Connect wallet
        </button>
        {open && (
          <div style={menuStyle}>
            {visibleWallets.map((w: any) => {
              const isWC = (w?.id === 'walletconnect' || w?.id === 'WALLETCONNECT');
              const label = isWC ? 'WalletConnect (QR)' : (w?.metadata?.name ?? String(w.id));
              return (
                <button
                  key={w.id}
                  type="button"
                  style={menuItemStyle}
                  onClick={async () => {
                    try {
                      if (isWC) {
                        // Force the chain when starting a WC session
                        // @ts-ignore (options signature varies by version)
                        await connect(w.id, { chain: caip });
                      } else {
                        await connect(w.id);
                      }
                    } catch (e) {
                      console.error('wallet connect error', e);
                    } finally {
                      setOpen(false);
                    }
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Connected
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={btnStyle}>
        {truncate(activeAddress)}
      </button>
      {open && (
        <div style={menuStyle}>
          <button
            type="button"
            style={menuItemStyle}
            onClick={async () => {
              try {
                await disconnect();
              } finally {
                setOpen(false);
              }
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#f9fafb',
  cursor: 'pointer',
  minWidth: 160,
  textAlign: 'center'
};

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
  minWidth: 220,
  zIndex: 30
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer'
};
