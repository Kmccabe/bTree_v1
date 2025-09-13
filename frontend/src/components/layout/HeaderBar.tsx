import React from 'react';
import { NavLink } from 'react-router-dom';
import ConnectButton from '../wallet/ConnectButton';

const linkStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', textDecoration: 'none' };
const active: React.CSSProperties = { fontWeight: 700, textDecoration: 'underline' };

export default function HeaderBar(): JSX.Element {
  return (
    <header style={{
      borderBottom: '1px solid #e5e7eb',
      position: 'sticky',
      top: 0,
      background: '#fff',
      zIndex: 10
    }}>
      <div style={{
        maxWidth: 1080, margin: '0 auto', padding: '0.75rem 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <NavLink to="/" style={{ ...linkStyle, fontSize: '1.1rem', fontWeight: 700 }}>
            bTree v2
          </NavLink>
          <nav aria-label="Main" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            <NavLink to="/" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Home</NavLink>
            <NavLink to="/subject" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Subject</NavLink>
            <NavLink to="/admin" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Admin</NavLink>
            <NavLink to="/docs" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Docs</NavLink>
            <NavLink to="/status" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Status</NavLink>
            <NavLink to="/legal" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? active : {}) })}>Legal</NavLink>
          </nav>
        </div>
        <div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
