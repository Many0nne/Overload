import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installGlobalErrorHandlers } from './data/errors';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { reloadOnceForChunk } from './ui/errorRecovery';
import './ui/styles/index.css';

installGlobalErrorHandlers(reloadOnceForChunk);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
