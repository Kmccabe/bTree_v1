
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import WalletProvider from './wallet/WalletProvider';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found in index.html');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <WalletProvider>
      <RouterProvider router={router} />
    </WalletProvider>
  </React.StrictMode>
);

