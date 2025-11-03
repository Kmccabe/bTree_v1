import React from 'react';
import { NavLink } from 'react-router-dom';
import HeaderStatus from '../HeaderStatus';

const linkStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', textDecoration: 'none' };
const active: React.CSSProperties = { fontWeight: 700, textDecoration: 'underline' };

export default function HeaderBar(): JSX.Element {
  const classicUrl = (import.meta as any).env?.VITE_CLASSIC_URL as string | undefined;

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
        <div className="ml-auto flex items-center gap-2 whitespace-nowrap md:gap-3">
          <HeaderStatus />
          {classicUrl ? (
            <a
              href={classicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-purple-700 hover:bg-purple-50"
            >
              Open classic app (v1)
            </a>
          ) : (
            <span className="text-xs text-gray-500">(set VITE_CLASSIC_URL to enable v1 link)</span>
          )}
        </div>
      </div>
    </header>
  );
}
