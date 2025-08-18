// client/config.js
// Stellt die API-URL je nach Umgebung korrekt ein und setzt ein gültiges Default-Studio.
(() => {
  const host = location.hostname;
  const isProd = host.endsWith('onrender.com') || host.endsWith('vercel.app') || host.endsWith('netlify.app');
  const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1';

  if (isProd) {
    // Backend läuft auf derselben Origin wie das Frontend
    window.API_BASE = `${location.origin}/api`;
  } else if (isLocal) {
    window.API_BASE = 'http://localhost:3001/api';
  } else {
    window.API_BASE = `${location.origin}/api`;
  }

  // Existierende Studios in den Seed-Daten: studioA, studioB
  window.DEFAULT_STUDIO = 'studioA';
})();
