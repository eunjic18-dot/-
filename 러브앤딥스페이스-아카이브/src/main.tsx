import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Analytics } from '@vercel/analytics/react';

// Initialize Google Analytics 4 if VITE_GA_ID is set in environment variables
const gaId = (import.meta as any).env?.VITE_GA_ID;
if (typeof window !== 'undefined' && gaId) {
  if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    const win = window as any;
    win.dataLayer = win.dataLayer || [];
    function gtag(...args: any[]) {
      win.dataLayer.push(arguments);
    }
    win.gtag = gtag;
    gtag('js', new Date());
    gtag('config', gaId);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);

