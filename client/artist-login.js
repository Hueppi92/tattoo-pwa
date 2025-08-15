const API_BASE = window.API_BASE || 'http://localhost:3001/api';

async function loadStudioTheme() {
  const p = new URLSearchParams(location.search);
  const studio = p.get('studio') || window.DEFAULT_STUDIO || null;
  const url = studio ? `${API_BASE}/studio/${studio}/config` : `${API_BASE}/studio/config`;
  try {
    const cfg = await fetch(url).then(r => r.ok ? r.json() : {});
    if (cfg.primaryColor)   document.documentElement.style.setProperty('--primary-color', cfg.primaryColor);
    if (cfg.secondaryColor) document.documentElement.style.setProperty('--secondary-color', cfg.secondaryColor);
    if (cfg.accentColor)    document.documentElement.style.setProperty('--accent-color', cfg.accentColor);
    if (cfg.fontBody)       document.documentElement.style.setProperty('--font-family', cfg.fontBody);
    if (cfg.bg) {
      document.body.style.backgroundImage = `url('${cfg.bg}')`;
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundAttachment = 'fixed';
    }
  } catch {}
}

function render() {
  const p = new URLSearchParams(location.search);
  const studio = p.get('studio') || window.DEFAULT_STUDIO || '';

  const root = document.getElementById('artist-login-app');
  root.innerHTML = `
    <div class="form-container">
      <h2>Artist Login</h2>
      <div class="form-group">
        <label>Artist-ID</label>
        <input id="a-user" type="text" placeholder="z. B. vorname.nachname"/>
      </div>
      <div class="form-group">
        <label>Passwort</label>
        <input id="a-pass" type="password" placeholder="Passwort"/>
      </div>
      <button id="a-login">Einloggen</button>
      <p id="msg"></p>
      <hr style="opacity:.2;margin:1rem 0">
      <p>Noch kein Konto?</p>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <a class="button-like" href="/artist-register.html${studio ? `?studio=${encodeURIComponent(studio)}` : ''}">Als Artist registrieren</a>
        <a class="button-like" href="/home.html${studio ? `?studio=${encodeURIComponent(studio)}` : ''}">Zurück</a>
      </div>
    </div>
  `;

  document.getElementById('a-login').addEventListener('click', async () => {
    const userId = document.getElementById('a-user').value.trim();
    const password = document.getElementById('a-pass').value;
    const msg = document.getElementById('msg');
    if (!userId || !password) {
      msg.textContent = 'Bitte beide Felder ausfüllen';
      msg.className = 'error';
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId, password, role:'artist' })
      }).then(r=>r.json());

      if (res.success) {
        const qsStudio = studio ? `&studio=${encodeURIComponent(studio)}` : '';
        location.href = `/artist.html?artistId=${encodeURIComponent(userId)}${qsStudio}`;
      } else {
        msg.textContent = res.error || 'Login fehlgeschlagen';
        msg.className = 'error';
      }
    } catch {
      msg.textContent = 'Netzwerkfehler';
      msg.className = 'error';
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadStudioTheme();
  render();
});
