import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Footer(): JSX.Element {
  return (
    <footer style={{ borderTop: '1px solid #e5e7eb', marginTop: '2rem' }}>
      <div style={{
        maxWidth: 1080, margin: '0 auto', padding: '1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem'
      }}>
        <small>© {new Date().getFullYear()} bTree</small>
        <nav aria-label="Legal" style={{ display: 'flex', gap: '0.5rem' }}>
          <NavLink to="/legal/privacy">Privacy</NavLink>
          <span>·</span>
          <NavLink to="/legal/terms">Terms</NavLink>
          <span>·</span>
          <NavLink to="/legal/consent">Consent</NavLink>
        </nav>
      </div>
    </footer>
  );
}

