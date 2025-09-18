import React from 'react';
import { NavLink } from 'react-router-dom';

export default function LegalHome(): JSX.Element {
  return (
    <main style={{ padding: '1rem 0' }}>
      <h1 style={{ marginTop: 0 }}>Legal</h1>
      <ul>
        <li><NavLink to="/legal/privacy">Privacy</NavLink></li>
        <li><NavLink to="/legal/terms">Terms</NavLink></li>
        <li><NavLink to="/legal/consent">Consent</NavLink></li>
      </ul>
    </main>
  );
}
