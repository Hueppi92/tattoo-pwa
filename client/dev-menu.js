// Dev-Menü zum einfachen Navigieren zwischen den Seiten während der Entwicklung.
// Dieses Skript fügt ein kleines Menü unten rechts ein, das Links zu allen
// verfügbaren HTML-Seiten der PWA enthält. Für die Produktion kann die
// Einbindung dieses Skriptes wieder entfernt werden.

function initDevMenu() {
  const pages = [
    { href: '/home.html', label: 'Startseite' },
    { href: '/index.html', label: 'Kundenbereich' },
    { href: '/artist-login.html', label: 'Artist‑Login' },
    { href: '/artist-register.html', label: 'Artist‑Registrierung' },
    { href: '/artist.html', label: 'Artist‑Seite' },
    { href: '/studio.html', label: 'Studio‑Manager' },
  ];

  const menu = document.createElement('div');
  menu.id = 'dev-menu';
  let linksHtml = '';
  // Build a base query string that persists current studio and forces dev mode
  const params = new URLSearchParams(window.location.search);
  // Default to exclusive-ink if no studio specified
  if (!params.has('studio')) params.set('studio', 'exclusive-ink');
  params.set('dev', '1');
  const baseQuery = params.toString();
  pages.forEach(p => {
    // Always append the query; pages in this PWA have no existing query in href
    linksHtml += `<a href="${p.href}?${baseQuery}">${p.label}</a>`;
  });
  menu.innerHTML = linksHtml;

  const style = document.createElement('style');
  style.textContent = `
    #dev-menu {
      position: fixed;
      bottom: 12px;
      right: 12px;
      background: rgba(0, 0, 0, 0.75);
      color: #ffffff;
      padding: 10px 12px;
      border-radius: 8px;
      z-index: 9999;
      font-size: 14px;
      line-height: 1.4;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
    #dev-menu a {
      display: block;
      color: #ffffff;
      text-decoration: none;
      margin: 2px 0;
    }
    #dev-menu a:hover {
      text-decoration: underline;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(menu);
}

// Warten bis DOM aufgebaut ist, dann Menü hinzufügen
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDevMenu);
} else {
  initDevMenu();
}