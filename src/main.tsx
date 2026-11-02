import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles/global.css';
import App from './App';
import { registerServiceWorker } from './sw-register';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Remove splash screen after React mounts.
const splash = document.getElementById('splash');
if (splash) {
  splash.style.opacity = '0';
  const removeSplash = () => {
    splash.remove();
    clearTimeout(fallbackTimeout);
  };
  splash.addEventListener('transitionend', removeSplash, { once: true });
  const fallbackTimeout = setTimeout(removeSplash, 2000);
}

// Register the service worker for offline/PWA support.
registerServiceWorker(import.meta.env.BASE_URL);
