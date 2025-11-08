import React from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { useWallet, PROVIDER_ID } from '@txnlab/use-wallet'; // NEW

// Pages
import Landing from './pages/Landing';
import About from './pages/About';
// import Subject from './pages/Subject'; // replaced by nested subject routes below
import NotFound from './pages/NotFound';
import DocsHome from './pages/DocsHome';
import DocPage from './pages/DocPage';
import LegalHome from './pages/legal/LegalHome';
import Privacy from './pages/legal/Privacy';
import Terms from './pages/legal/Terms';
import Consent from './pages/legal/Consent';
import Status from './pages/Status';
import Register from "./pages/subject/Register";
import LinkWallets from "./pages/subject/LinkWallets";
import SignupPage1 from "./pages/subject/SignupPage1";
import AdminHome from "./pages/admin/AdminHome";
import AdminSubjectPool from "./pages/admin/SubjectPool";
import RegistryControls from "./pages/admin/RegistryControls";
import SubjectPoolIndexer from "./pages/admin/SubjectPoolIndexer";

/* ---------- Inline stubs for /subject/* (we'll move to separate files later) ---------- */
function SubjectLayout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded text-sm font-medium ${
      isActive ? 'bg-blue-100 text-blue-700' : 'text-blue-700 hover:bg-blue-50'
    }`;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Subject Dashboard</h1>
      <nav className="flex gap-3">
        <NavLink to="signin" className={link}>Sign-In   </NavLink>
        <NavLink to="register" className={link}>Register   </NavLink>
        <NavLink to="showup" className={link}>Show-Up   </NavLink>
        <NavLink to="play" className={link}>Play</NavLink>
      </nav>
      <div className="border-t pt-4">
        <Outlet />
      </div>
    </div>
  );
}

function SubjectSignIn() {
  const { activeAddress, providers, clients } = useWallet();
  const pera = React.useMemo(
    () => providers?.find(p => p.metadata.id === PROVIDER_ID.PERA),
    [providers]
  );

  const handleConnect = React.useCallback(async () => {
    const target = pera ?? providers?.[0];
    const peraClient = clients?.[PROVIDER_ID.PERA];
    if (!target) {
      console.warn('Wallet provider not initialized yet');
      return;
    }
    try {
      await target.connect();
      if (!target.isActive) target.setActiveProvider?.();
    } catch (err: any) {
      const msg = String(err?.message || err).toLowerCase();
      if (msg.includes('currently connected') && peraClient) {
        try {
          await peraClient.reconnect(() => {});
          if (!target.isActive) target.setActiveProvider?.();
        } catch (e) {
          console.error('Reconnect failed:', e);
        }
      } else {
        console.error('Connect failed:', err);
      }
    }
  }, [clients, pera, providers]);

  const handleDisconnect = React.useCallback(async () => {
    try { await pera?.disconnect(); } catch {}
    try { await clients?.[PROVIDER_ID.PERA]?.disconnect?.(); } catch {}
  }, [clients, pera]);

  React.useEffect(() => {
    if (!pera) return;
    if (Array.isArray(pera.accounts) && pera.accounts.length > 0 && !pera.isActive) {
      try { pera.setActiveProvider?.(); } catch {}
    }
  }, [pera]);

  const short = (a?: string | null) =>
    (a && a.length > 12) ? `${a.slice(0,6)}...${a.slice(-6)}` : (a || '');

  const statusLines = (
    <div className="mt-3 text-xs text-neutral-500 space-y-1">
      <div>Pera active: {String(!!pera?.isActive)}</div>
      <div>Pera accounts: {pera?.accounts?.length ?? 0}</div>
      <div>Active address: {activeAddress ? short(activeAddress) : '(none)'}</div>
    </div>
  );

  return (
    <div className="space-y-2">
      <h2 className="font-semibold">Wallet Sign-In</h2>
      {activeAddress ? (
        <div className="text-sm text-neutral-700">
          <div>Connected as <code>{short(activeAddress)}</code></div>
          <div className="mt-2">
            <button className="underline text-sm" onClick={handleDisconnect}>Disconnect</button>
          </div>
          <div className="mt-3 text-xs text-neutral-500">
            Next: go to <NavLink to="../register" className="underline">Register</NavLink>.
          </div>
          {statusLines}
        </div>
      ) : (
        <div className="text-sm text-neutral-700">
          <button className="underline text-sm" onClick={handleConnect}>Connect Pera Wallet</button>
          <div className="mt-2 text-xs text-neutral-500">
            Uses the same Pera-first flow as the main app.
          </div>
          {statusLines}
        </div>
      )}
    </div>
  );
}


function SubjectRegister() {
  return (
    <div>
      <h2 className="font-semibold">Register Intent</h2>
      <p className="text-sm text-neutral-700">
        This will record your intent to participate in the Trust Experiment.
      </p>
      <button className="mt-2 border rounded px-3 py-1 text-sm bg-blue-50 text-blue-700" disabled>
        Register (coming soon)
      </button>
    </div>
  );
}

function SubjectShowUp() {
  return (
    <div>
      <h2 className="font-semibold">Show Up</h2>
      <p className="text-sm text-neutral-700">
        When the experiment starts, you'll confirm your participation by opting in on-chain.
      </p>
      <button className="mt-2 border rounded px-3 py-1 text-sm bg-blue-50 text-blue-700" disabled>
        Opt In (coming soon)
      </button>
    </div>
  );
}

function SubjectPlay() {
  return (
    <div>
      <h2 className="font-semibold">Play the Trust Game</h2>
      <p className="text-sm text-neutral-700">Game controls will be added next.</p>
    </div>
  );
}
/* --------------------------------------------------------------------------------------- */

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'about', element: <About /> },

      // Subject dashboard with nested subpages
      {
        path: 'subject',
        element: <SubjectLayout />,
        children: [
          { index: true, element: <Navigate to="signin" replace /> },
          { path: 'signin', element: <SubjectSignIn /> },
          { path: 'register', element: <Register /> },
          { path: 'showup', element: <SubjectShowUp /> },
          { path: 'play', element: <SubjectPlay /> },
          { path: 'link', element: <LinkWallets /> },
        ],
      },
      { path: 'subject/signup', element: <SignupPage1 /> },

      // Existing pages
      { path: 'docs', element: <DocsHome /> },
      { path: 'docs/:slug', element: <DocPage /> },
      { path: 'legal', element: <LegalHome /> },
      { path: 'legal/privacy', element: <Privacy /> },
      { path: 'legal/terms', element: <Terms /> },
      { path: 'legal/consent', element: <Consent /> },
      { path: 'status', element: <Status /> },
      { path: 'admin', element: <AdminHome /> },
      { path: 'admin/subject-pool', element: <AdminSubjectPool /> },
      { path: 'admin/registry-controls', element: <RegistryControls /> },
      { path: 'admin/subject-pool-indexer', element: <SubjectPoolIndexer /> },

      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default router;
