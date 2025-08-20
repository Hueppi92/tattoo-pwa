// client/dev-menu.js
// Developer Menu – STRG+M toggelt, ⚙-Badge oben rechts

(() => {
  // ---- Menü ---------------------------------------------------------------
  const menu = document.createElement('div');
  menu.id = 'dev-menu';
  Object.assign(menu.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '9999',
    background: 'rgba(0,0,0,0.85)',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '12px',
    fontFamily: 'sans-serif',
    fontSize: '14px',
    display: 'none', // default: hidden
    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
    maxWidth: '250px'
  });

  menu.innerHTML = `
    <strong style="letter-spacing:.5px;">DEV-MENÜ</strong><br/>
    <a href="/manager-login.html" style="color:#0af;display:block;margin:6px 0;">Manager Login</a>
    <a href="/artist-login.html" style="color:#0af;display:block;margin:6px 0;">Artist Login</a>
    <a href="/customer-login.html" style="color:#0af;display:block;margin:6px 0;">Customer Login</a>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,.15);margin:8px 0;">
    <a href="/studio.html" style="color:#0af;display:block;margin:6px 0;">Studio Dashboard</a>
    <a href="/artist.html" style="color:#0af;display:block;margin:6px 0;">Artist Dashboard</a>
    <a href="/home.html" style="color:#0af;display:block;margin:6px 0;">Customer Home</a>
  `;

  document.body.appendChild(menu);

  // Persistenter Zustand (optional)
  const STORAGE_KEY = 'dev_menu_visible';
  const setVisible = (v) => {
    menu.style.display = v ? 'block' : 'none';
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
  };
  const initial = (() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  })();
  setVisible(initial);

  // STRG+M toggelt Menü
  document.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey && ev.key.toLowerCase() === 'm') {
      setVisible(menu.style.display === 'none');
    }
  });

  // ---- Badge (⚙) oben rechts ---------------------------------------------
  const badge = document.createElement('div');
  badge.textContent = '⚙';
  Object.assign(badge.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    fontSize: '20px',
    cursor: 'pointer',
    zIndex: '9999',
    userSelect: 'none',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
  });
  badge.title = 'Dev-Menü (Strg+M)';

  badge.addEventListener('click', () => {
    setVisible(menu.style.display === 'none');
  });

  document.body.appendChild(badge);
})();
