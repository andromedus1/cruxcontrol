import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { registerServiceWorker } from './pwa/register-sw.ts';

// Start once at module scope. React StrictMode intentionally mounts effects
// twice in development; a lock lease must not be released by that lifecycle.
const updateService = registerServiceWorker();
const startupAdmission = updateService.start();

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <App updateService={updateService} startupAdmission={startupAdmission} />
  </StrictMode>,
);
