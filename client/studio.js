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

  document.getElementById('m-login').addEventListener('click', async () => {
    const user = document.getElementById('m-user').value.trim();
    const password = document.getElementById('m-pass').value;
    const studioId = sel.value;
    const res = await fetch(`${API_BASE}/studio/${studioId}/manager/login`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
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
