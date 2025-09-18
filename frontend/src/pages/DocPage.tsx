import React from 'react';
import { useParams, NavLink } from 'react-router-dom';

const CONTENT: Record<string, { title: string; body: React.ReactNode }> = {
  'getting-started': {
    title: 'Getting started',
    body: (
      <>
        <p>Use the header to navigate. Subjects can open <code>/subject</code> and join sessions.</p>
        <p>Experimenters can use the classic app (v1) for wallet actions while v2 is in progress.</p>
      </>
    ),
  },
  'trust-game': {
    title: 'Trust game overview',
    body: (
      <>
        <p>S1 invests <code>s</code>; S2 returns <code>r</code> with <code>0 ≤ r ≤ t = m × s</code> and UNIT multiples enforced.</p>
        <p>Phases: 0 (setup), 1 (invest), 2 (return), 3 (finalize).</p>
      </>
    ),
  },
  'troubleshooting': {
    title: 'Troubleshooting (quick tips)',
    body: (
      <>
        <ul>
          <li>If something is disabled, hover for a tooltip explaining why.</li>
          <li>If using the classic app, ensure the wallet is on TestNet.</li>
          <li>Refresh if recent actions haven’t appeared yet.</li>
        </ul>
      </>
    ),
  },
  'export': {
    title: 'Data export (CSV)',
    body: (
      <>
        <p>CSV includes timestamps (UTC), addresses, <code>s</code>, <code>t</code>, <code>r</code>, payouts and txIDs.</p>
        <p>In v1 this is available via the Export button; v2 will integrate later.</p>
      </>
    ),
  },
};

export default function DocPage(): JSX.Element {
  const { slug = '' } = useParams();
  const doc = CONTENT[slug];

  return (
    <main style={{ padding: '1rem 0' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <NavLink to="/docs" style={{ textDecoration: 'none' }}>&larr; Back to docs</NavLink>
      </div>
      {doc ? (
        <>
          <h1 style={{ marginTop: 0 }}>{doc.title}</h1>
          <div style={{ color: '#111827' }}>{doc.body}</div>
        </>
      ) : (
        <>
          <h1 style={{ marginTop: 0 }}>Not found</h1>
          <p>This topic doesn’t exist yet.</p>
        </>
      )}
    </main>
  );
}
