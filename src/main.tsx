import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

const scheduleSwRegistration = () => {
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(() => registerSW({ immediate: true }), { timeout: 3000 });
  } else {
    setTimeout(() => registerSW({ immediate: true }), 1000);
  }
};

if (document.readyState === 'complete') {
  scheduleSwRegistration();
} else {
  window.addEventListener('load', scheduleSwRegistration, { once: true });
}
