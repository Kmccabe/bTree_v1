import React from 'react';
import { Outlet } from 'react-router-dom';
import HeaderBar from './HeaderBar';
import Footer from './Footer';

export default function Layout(): JSX.Element {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <HeaderBar />
      <main style={{ flex: 1 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1rem' }}>
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}

