import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/layout/Layout';

// Page stubs (ensure these exist; create minimal ones if missing)
import Landing from './pages/Landing';
import Subject from './pages/Subject';
import NotFound from './pages/NotFound';

// Optional: import other stubs if already created
// import Session from './pages/Session';
// import Admin from './pages/Admin';
// import DocsHome from './pages/DocsHome';
// import DocPage from './pages/DocPage';
// import LegalHome from './pages/legal/LegalHome';
// import Privacy from './pages/legal/Privacy';
// import Terms from './pages/legal/Terms';
// import Consent from './pages/legal/Consent';
// import Status from './pages/Status';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'subject', element: <Subject /> },

      // keep these routes if stubs exist; otherwise they can be added later
      // { path: 'session/:appId', element: <Session /> },
      // { path: 'admin', element: <Admin /> },
      // { path: 'docs', element: <DocsHome /> },
      // { path: 'docs/:slug', element: <DocPage /> },
      // { path: 'legal', element: <LegalHome /> },
      // { path: 'legal/privacy', element: <Privacy /> },
      // { path: 'legal/terms', element: <Terms /> },
      // { path: 'legal/consent', element: <Consent /> },
      // { path: 'status', element: <Status /> },

      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default router;
