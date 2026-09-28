import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../../web/src/App.tsx';
import { createPrototypeRuntime } from './runtime.ts';

// Bundled apps have no service-worker admission. Native plugins are composed
// here so the production PWA keeps its existing bootstrap and dependency graph.
const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');
createRoot(root).render(
  <StrictMode>
    <App createRuntime={createPrototypeRuntime} />
  </StrictMode>,
);
