import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { applyTheme, savedTheme } from './pages/Settings';

applyTheme(savedTheme());
// Privacy mode starts on each time the app opens, unless switched off in Settings.
import { useStore } from './data/store';
import { usePrivacy } from './lib/privacy';
if (useStore.getState().data.settings.hideAmountsOnOpen !== false && !new URLSearchParams(location.search).has('show')) usePrivacy.getState().setHidden(true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable app + offline support when hosted on its own website (not inside the claude.ai viewer).
if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator && !(window as any).claude) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
