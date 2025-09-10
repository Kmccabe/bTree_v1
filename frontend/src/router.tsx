import React from "react";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import Landing from "./pages/Landing";
import Subject from "./pages/Subject";
import Session from "./pages/Session";
import Admin from "./pages/Admin";
import DocsHome from "./pages/DocsHome";
import DocPage from "./pages/DocPage";
import LegalHome from "./pages/legal/LegalHome";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import Consent from "./pages/legal/Consent";
import Status from "./pages/Status";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/subject", element: <Subject /> },
  { path: "/session/:appId", element: <Session /> },
  { path: "/admin", element: <Admin /> },
  { path: "/docs", element: <DocsHome /> },
  { path: "/docs/:slug", element: <DocPage /> },
  { path: "/legal", element: <LegalHome /> },
  { path: "/legal/privacy", element: <Privacy /> },
  { path: "/legal/terms", element: <Terms /> },
  { path: "/legal/consent", element: <Consent /> },
  { path: "/status", element: <Status /> },
  { path: "*", element: <NotFound /> },
]);

export function AppRouterProvider(): JSX.Element {
  return <RouterProvider router={router} />;
}

