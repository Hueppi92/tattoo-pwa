// client/config.js
// Zentrale Konfiguration fürs Frontend

// API-Basis: same-origin über den Node-Service,
// der sowohl PWA als auch API ausliefert.
window.API_BASE = '/api';

// (Optional) Studio-Konfiguration – falls du später Multimandanten willst.
// window.STUDIO_ID = 'default-studio';

// (Optional) Debug-Flag für ausführlichere Logs im Browser.
window.APP_DEBUG = false;

// Helper für Logging (nur wenn APP_DEBUG=true)
window.log = (...args) => {
  if (window.APP_DEBUG) console.log('[PWA]', ...args);
};
