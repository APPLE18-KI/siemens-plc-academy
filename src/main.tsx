import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/v2.css';
import './styles/mobile-fit.css';
import './styles/v22.css';
import './styles/v30.css';
import { installHScrollHints } from './app/hscrollHints';
import { App } from './app/App';

// 网页环境（http/https）注册离线缓存；Android App（Capacitor）与 file:// 下不注册
if (
  'serviceWorker' in navigator &&
  /^https?:$/.test(window.location.protocol) &&
  !(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() &&
  import.meta.env.PROD
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

installHScrollHints();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
