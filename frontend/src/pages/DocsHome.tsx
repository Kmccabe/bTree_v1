import React from 'react';
import { NavLink } from 'react-router-dom';

export default function DocsHome(): JSX.Element {
  const link = (to: string, label: string) => (
    <NavLink to={to} style={{ textDecoration: 'none', color: '#111827' }}>
      <div style={{
        border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem 1rem',
        background: '#fff'
      }}>
        <strong>{label}</strong>
        <div style={{ color: '#6b7280', marginTop: 4 }}>Read more…</div>
      </div>
    </NavLink>
  );

  return (
    <main style={{ padding: '1rem 0' }}>
      <h1 style={{ marginTop: 0 }}>Documentation</h1>
      <p style={{ color: '#4b5563' }}>
        Short guides for subjects and experimenters. This v2 site is in progress; wallet actions still run on the classic app (v1).
      </p>

      <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 800 }}>
        {link('/docs/getting-started', 'Getting started')}
        {link('/docs/trust-game', 'Trust game overview')}
        {link('/docs/troubleshooting', 'Troubleshooting')}
        {link('/docs/export', 'Data export (CSV)')}
      </div>
    </main>
  );
}
