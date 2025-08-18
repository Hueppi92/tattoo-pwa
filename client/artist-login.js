/* client/artist-login.js */
const API_BASE = window.API_BASE || 'http://localhost:3001/api';

async function loadStudioTheme() {
  const p = new URLSearchParams(location.search);
  const studio = p.get('studio') || window.DEFAULT_STUDIO || null;
  if (!studio) return; // kein Fallback-Endpunkt ohne ID → 404 vermeiden

  try {
    const url = `${API_BASE}/studio/${encodeURIComponent(studio)}/config`;
    const r = await fetch(url);
    if (!r.ok) return;
    const cfg = await r.json();
    if (cfg.primaryColor)   document.documentElement.style.setProperty('--primary-color', cfg.primaryColor);
    if (cfg.secondaryColor) document.documentElement.style.setProperty('--secondary-color', cfg.secondaryColor);
    if (cfg.accentColor)    document.documentElement.style.setProperty('--accent-color', cfg.accentColor);
    if (cfg.fontBody)       document.documentElement.style.setProperty('--font-family', cfg.fontBody);
    if (cfg.bg) {
      document.body.style.backgroundImage = `url('${cfg.bg}')`;
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
    }
  } catch (e) {
    console.warn('Theme laden fehlgeschlagen:', e);
  }
}

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else if (c) el.appendChild(c);
  }
  return el;
}

function renderLogin(target) {
  const p = new URLSearchParams(location.search);
  const studio = p.get('studio') || window.DEFAULT_STUDIO || '';

  const $user = h('input', { type:'text', placeholder:'Artist-ID (z. B. artistA)', autocomplete:'username' });
  const $pass = h('input', { type:'password', placeholder:'Passwort (z. B. devpass)', autocomplete:'current-password' });
  const $studio = h('input', { type:'text', placeholder:'Studio-ID (z. B. studioA)', value: studio });

  const $btn = h('button', { type:'button' }, 'Login');
  const $msg = h('div', { class:'msg' });

  $btn.addEventListener('click', async () => {
    const userId = $user.value.trim();
    const password = $pass.value;
    const studioId = $studio.value.trim();

    if (!userId || !password) {
      $msg.textContent = 'Bitte User & Passwort eingeben.';
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password, role: 'artist' })
      }).then(r => r.json());

      if (res && res.success) {
        const qsStudio = studioId ? `&studio=${encodeURIComponent(studioId)}` : '';
        location.href = `/artist.html?artistId=${encodeURIComponent(userId)}${qsStudio}`;
      } else {
        $msg.textContent = (res && res.error) ? res.error : 'Login fehlgeschlagen.';
      }
    } catch (e) {
      console.error(e);
      $msg.textContent = 'Server nicht erreichbar.';
    }
  });

  target.replaceChildren(
    h('div', { class:'login-card' },
      h('h1', {}, 'Artist Login'),
      h('label', {}, 'Artist-ID'),
      $user,
      h('label', {}, 'Passwort'),
      $pass,
      h('label', {}, 'Studio-ID (optional)'),
      $studio,
      $btn,
      $msg
    )
  );
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadStudioTheme();
  const mount = document.getElementById('artist-login-app') || document.body;
  renderLogin(mount);
});
