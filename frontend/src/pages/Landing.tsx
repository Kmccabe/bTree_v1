import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Landing(): JSX.Element {
  const classicUrl =
    (import.meta as any).env?.VITE_CLASSIC_URL as string | undefined;

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
            style={{
              padding: '0.6rem 1rem',
              border: '1px solid #111827',
              borderRadius: 8,
              background: '#111827',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            Join as Subject
          </NavLink>

          {/* Secondary CTA — open classic/v1 for experimenter */}
          {classicUrl ? (
            <a
              href={classicUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '0.6rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                background: '#f9fafb',
                color: '#111827',
                textDecoration: 'none',
                fontWeight: 600
              }}
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
