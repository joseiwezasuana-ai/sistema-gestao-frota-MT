import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import SystemErrorBoundary from './components/SystemErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { initScreenSizeWatcher } from './lib/screenDetector';

// Initialize reactive screen dimension detection and mobile viewport locking
initScreenSizeWatcher();

// Register service worker safely without blocking dialogs in sandboxed environments
const updateSW = registerSW({
  onNeedRefresh() {
    // Auto-activate new worker safely in iframe
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App pronta para uso offline!');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      <App />
    </SystemErrorBoundary>
  </StrictMode>,
);
