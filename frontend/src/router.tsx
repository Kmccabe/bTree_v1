import React from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet } from 'react-router-dom';
import Layout from './components/layout/Layout';

// Pages
import Landing from './pages/Landing';
// import Subject from './pages/Subject'; // replaced by nested subject routes below
import NotFound from './pages/NotFound';
import DocsHome from './pages/DocsHome';
import DocPage from './pages/DocPage';
import LegalHome from './pages/legal/LegalHome';
import Privacy from './pages/legal/Privacy';
import Terms from './pages/legal/Terms';
import Consent from './pages/legal/Consent';
import Status from './pages/Status';

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
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">Wallet Sign-In</h2>
      <p className="text-sm text-neutral-700">Connect / disconnect your wallet here.</p>
      <p className="text-xs text-neutral-500">Next: go to <code>/subject/register</code>.</p>
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
        When the experiment starts, you’ll confirm your participation by opting in on-chain.
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

      // Subject dashboard with nested subpages
      {
        path: 'subject',
        element: <SubjectLayout />,
        children: [
          { index: true, element: <Navigate to="signin" replace /> },
          { path: 'signin', element: <SubjectSignIn /> },
          { path: 'register', element: <SubjectRegister /> },
          { path: 'showup', element: <SubjectShowUp /> },
          { path: 'play', element: <SubjectPlay /> },
        ],
      },

      // Existing pages
      { path: 'docs', element: <DocsHome /> },
      { path: 'docs/:slug', element: <DocPage /> },
      { path: 'legal', element: <LegalHome /> },
      { path: 'legal/privacy', element: <Privacy /> },
      { path: 'legal/terms', element: <Terms /> },
      { path: 'legal/consent', element: <Consent /> },
      { path: 'status', element: <Status /> },

      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default router;
