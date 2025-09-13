import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import Landing from './pages/Landing';
import Subject from './pages/Subject';
import NotFound from './pages/NotFound';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/subject', element: <Subject /> },
  { path: '*', element: <NotFound /> },
]);

export default router;
