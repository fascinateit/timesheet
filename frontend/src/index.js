import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Keep the browser's "install app" prompt so the in-app Install button can show it later.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.__pwaPrompt = e;
  window.dispatchEvent(new Event('pwa-installable'));
});
window.addEventListener('appinstalled', () => {
  window.__pwaPrompt = null;
  window.dispatchEvent(new Event('pwa-installed'));
});

// Service worker: production builds only (needs HTTPS or localhost).
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL || ''}/service-worker.js`).catch(() => {});
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
