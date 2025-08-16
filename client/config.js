// Single Source of Truth für die API-Basis.
// Priorität: window.__API_BASE__  >  import.meta.env.VITE_API_BASE  >  process.env.*  >  '/api'
export const apiBase = (() => {
  const fromGlobal =
    typeof window !== 'undefined' && window.__API_BASE__;
  const fromImportMeta =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_API_BASE || import.meta.env.PUBLIC_API_BASE);
  const fromNode =
    typeof process !== 'undefined' &&
    process.env &&
    (process.env.VITE_API_BASE || process.env.API_BASE);

  // Fallback: relative Route (z. B. via Reverse Proxy / Vite-Proxy)
  const base = fromGlobal || fromImportMeta || fromNode || '/api';

  // Trailing Slashes entfernen, damit später keine Doppel-Slashes entstehen
  return String(base).replace(/\/+$/, '');
})();

// Hilfsfunktion: baut sichere Endpunkte ohne Doppel-Slashes
export const endpoint = (path = '') =>
  `${apiBase}/${String(path).replace(/^\/+/, '')}`;
