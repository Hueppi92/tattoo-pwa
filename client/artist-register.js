const API_BASE   = window.API_BASE || 'http://localhost:3001/api';

function applyTheme(t) {
  if (t.primaryColor)   document.documentElement.style.setProperty('--primary-color', t.primaryColor);
  if (t.secondaryColor) document.documentElement.style.setProperty('--secondary-color', t.secondaryColor);
  if (t.accentColor)    document.documentElement.style.setProperty('--accent-color', t.accentColor);
  if (t.fontBody)       document.documentElement.style.setProperty('--font-family', t.fontBody);
  if (t.bg) {
    document.body.style.backgroundImage = `url('${t.bg}')`;
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundAttachment = 'fixed';
  }
}

async function fetchStudios() {
  const r = await fetch(`${API_BASE}/studios`);
  return r.ok ? r.json() : [];
}
async function fetchStudioConfig(id) {
  const r = await fetch(`${API_BASE}/studio/${id}/config`);
  return r.ok ? r.json() : {};
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const preselectStudio = params.get('studio') || window.DEFAULT_STUDIO || null;
  const isDev = params.has('dev');

  const app = document.getElementById('artist-reg-app');
  app.innerHTML = `
    <div class="form-container card--lux">
      <h2>Artist registrieren</h2>
      <div class="form-group">
        <label>Studio</label>
        <select id="studio-sel"></select>
      </div>
      <div class="form-group">
        <label>Artist-ID</label>
        <input id="artist-id" type="text" placeholder="z. B. vorname.nachname" />
      </div>
      <div class="form-group">
        <label>Name</label>
        <input id="artist-name" type="text" placeholder="Anzeigename" />
      </div>
      <div class="form-group">
        <label>Passwort</label>
        <input id="artist-pass" type="password" placeholder="Passwort" />
      </div>
      <button id="reg-btn">Konto anlegen</button>
      <p id="msg"></p>
      <p style="margin-top:1rem"><a id="back-link" href="/index.html">Zurück zum Login</a></p>
    </div>`;

  // Studios laden & Dropdown füllen
  const studios = await fetchStudios();
  const sel = document.getElementById('studio-sel');
  studios.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.name;
    sel.appendChild(o);
  });
  if (preselectStudio && studios.some(s => s.id === preselectStudio)) sel.value = preselectStudio;

  // Theme laden beim Wechsel
  async function setThemeByStudio(id) {
    const cfg = await fetchStudioConfig(id);
    applyTheme(cfg);
  }
  if (sel.value) setThemeByStudio(sel.value);
  sel.addEventListener('change', () => setThemeByStudio(sel.value));

  // Back-Link Studio beibehalten
  const back = document.getElementById('back-link');
  {
    const q = new URLSearchParams();
    if (sel.value) q.set('studio', sel.value);
    if (isDev) q.set('dev', '1');
    const qs = q.toString();
    back.href = `/index.html${qs ? `?${qs}` : ''}`;
  }

  // Registrierung
  document.getElementById('reg-btn').addEventListener('click', async () => {
    const studioId = sel.value;
    const artistId = document.getElementById('artist-id').value.trim();
    const name     = document.getElementById('artist-name').value.trim();
    const password = document.getElementById('artist-pass').value;

    const msg = document.getElementById('msg');
    if (!studioId || !artistId || !password) {
      msg.textContent = 'Bitte Studio, Artist-ID und Passwort ausfüllen.';
      msg.className = 'error'; return;
    }

    const res = await fetch(`${API_BASE}/artist/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistId, password, name, studioId })
    }).then(r => r.json()).catch(() => ({}));

    if (res && res.success) {
      msg.textContent = 'Registrierung erfolgreich. Weiterleitung…';
      msg.className = 'success';
      setTimeout(() => {
        const q = new URLSearchParams();
        q.set('artistId', artistId);
        q.set('studio', studioId);
        if (isDev) q.set('dev', '1');
        window.location.href = `/artist.html?${q.toString()}`;
      }, 800);
    } else {
      msg.textContent = (res && res.error) || 'Registrierung fehlgeschlagen.';
      msg.className = 'error';
    }
  });
}

document.addEventListener('DOMContentLoaded', boot);
