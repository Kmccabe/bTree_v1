import React from 'react';
import { useWallet, Wallet } from '@txnlab/use-wallet-react';

function truncate(addr: string, left = 6, right = 4): string {
  if (!addr) return '';
  return addr.length <= left + right ? addr : `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

export default function ConnectButton(): JSX.Element {
  const { wallets, activeAddress, isReady, isConnected, connect, disconnect } = useWallet();

  // Simple dropdown state (no external UI libs)
  const [open, setOpen] = React.useState(false);

  if (!isReady) {
    return (
      <button type="button" disabled style={btnStyle}>
        Initializing…
      </button>
    );
  }

  if (!isConnected || !activeAddress) {
    // Show a list of available wallets to connect
    return (
      <div style={{ position: 'relative' }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={btnStyle}>
          Connect wallet
        </button>
        {open && (
          <div style={menuStyle}>
            {wallets.map((w: Wallet) => (
              <button
                key={w.id}
                type="button"
                style={menuItemStyle}
                onClick={async () => {
                  try {
                    await connect(w.id);
                    setOpen(false);
                  } catch (e) {
                    console.error('wallet connect error', e);
                    setOpen(false);
                  }
                }}
              >
                {w.metadata.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Connected — show truncated address with Disconnect
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={btnStyle}>
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

