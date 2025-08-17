const API_BASE = 'http://localhost:3001/api';

function applyTheme(t) {
  if (t.primaryColor)   document.documentElement.style.setProperty('--primary-color', t.primaryColor);
  if (t.secondaryColor) document.documentElement.style.setProperty('--secondary-color', t.secondaryColor);
  if (t.accentColor)    document.documentElement.style.setProperty('--accent-color', t.accentColor);
  if (t.fontBody)       document.documentElement.style.setProperty('--font-family', t.fontBody);
  if (t.bg)             document.body.style.backgroundImage = `url('${t.bg}')`;
}

async function boot() {
  const root = document.getElementById('studio-app');
  root.innerHTML = `
    <div class="form-container card--lux">
      <h2>Studio-Manager</h2>
      <div class="form-group">
        <label>Studio</label>
        <select id="studio-sel"></select>
      </div>
      <div class="form-group"><label>User</label><input id="m-user" type="text" /></div>
      <div class="form-group"><label>Passwort</label><input id="m-pass" type="password" /></div>
      <button id="m-login">Anmelden</button>
      <p id="m-msg"></p>
    </div>`;

  // Studios laden
  const studios = await fetch(`${API_BASE}/studios`).then(r => r.json());
  const sel = document.getElementById('studio-sel');
  studios.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });

  const setTheme = async (id) => {
    const cfg = await fetch(`${API_BASE}/studio/${id}/config`).then(r => r.json());
    applyTheme(cfg);
    // kleine Variation der Card je Studio
    const card = document.querySelector('.form-container');
    card.classList.remove('card--lux','card--ink','card--urban');
    if (id === 'exclusive-ink') card.classList.add('card--lux');
    else if (id === 'secret-ink') card.classList.add('card--ink');
    else card.classList.add('card--urban');
  };

  await setTheme(sel.value);
  sel.addEventListener('change', () => setTheme(sel.value));

  // Automatischer Dev-Login für Studio-Manager
  const urlParams = new URLSearchParams(window.location.search);
  const isDev = urlParams.has('dev');
  const paramStudio = urlParams.get('studio');
  if (isDev) {
    // Finde das zu nutzende Studio: Priorität URL-Parameter, sonst erstes
    const studioId = paramStudio || (studios[0] && studios[0].id) || 'exclusive-ink';
    // Bestimme Manager-Credentials pro Studio
    const credMap = {
      'exclusive-ink': { user: 'manager@exclusive', password: 'pass123' },
      'secret-ink':    { user: 'manager@secret',    password: 'pass123' },
      'monkeybrothers':{ user: 'manager@monkey',    password: 'pass123' }
    };
    const creds = credMap[studioId] || credMap['exclusive-ink'];
    try {
      const res = await fetch(`${API_BASE}/studio/${studioId}/manager/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: creds.user, password: creds.password })
      }).then(r => r.json());
      if (res && res.success) {
        window.location.href = `/index.html?studio=${encodeURIComponent(studioId)}&dev=1`;
        return;
      }
    } catch (e) {
      // ignore and continue to normal flow
    }
  }

  document.getElementById('m-login').addEventListener('click', async () => {
    const user = document.getElementById('m-user').value.trim();
    const password = document.getElementById('m-pass').value;
    const studioId = sel.value;
    const res = await fetch(`${API_BASE}/studio/${studioId}/manager/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, password })
    }).then(r => r.json());

    const msg = document.getElementById('m-msg');
    if (res.success) {
      msg.className = 'success'; msg.textContent = 'Login erfolgreich';
      window.location.href = `/index.html?studio=${encodeURIComponent(studioId)}`;
    } else {
      msg.className = 'error'; msg.textContent = res.error || 'Login fehlgeschlagen';
    }
  });
}
document.addEventListener('DOMContentLoaded', boot);
