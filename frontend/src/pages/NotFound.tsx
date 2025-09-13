import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound(): JSX.Element {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Page not found</h1>
      <p><Link to="/">Go home</Link> or try <Link to="/subject">/subject</Link>.</p>
    </main>
  );
}
