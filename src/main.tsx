import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/app/routing/router';
import './styles/global.css';

const container = document.querySelector('#root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
