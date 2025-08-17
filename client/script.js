// Hauptskript für die Tattoo-PWA (Kunden-Seite / index.html)

const API_BASE   = window.API_BASE || 'http://localhost:3001/api';
const API_ORIGIN = API_BASE.replace(/\/api$/, '');
const toAbs = (p) => (p && p.startsWith('/uploads/')) ? `${API_ORIGIN}${p}` : p;

/** Datei -> Base64 (DataURL) */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/** App-Bootstrap */
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const studioId = params.get('studio') || null;
  window.__studio = studioId;

  loadStudioConfig(studioId).finally(() => {
    const clientId = params.get('clientId');
    const registerMode = params.get('register');
    if (clientId && registerMode !== null) {
      showRegisterForm(clientId);
    } else {
      showLoginForm();
    }
  });
});

/** Studio-Theme laden & anwenden */
function loadStudioConfig(studioId = null) {
  const endpoint = studioId
    ? `${API_BASE}/studio/${studioId}/config`
    : `${API_BASE}/studio/config`;

  return fetch(endpoint)
    .then((resp) => resp.ok ? resp.json() : {})
    .then((cfg) => {
      const primary   = cfg.primaryColor   || '#2c2c2c';
      const secondary = cfg.secondaryColor || '#fefefe';
      const accent    = cfg.accentColor    || '#c9a56c';
      const fontBody  = cfg.fontBody       || 'Inter, system-ui, sans-serif';
      const bg        = cfg.bg             || 'assets/marble-bg.png';

      document.documentElement.style.setProperty('--primary-color', primary);
      document.documentElement.style.setProperty('--secondary-color', secondary);
      document.documentElement.style.setProperty('--accent-color', accent);
      document.documentElement.style.setProperty('--font-family', fontBody);

      document.documentElement.style.setProperty('--card-bg', 'rgba(255,255,255,0.20)');
      document.documentElement.style.setProperty('--card-border', 'rgba(255,255,255,0.40)');
      document.documentElement.style.setProperty('--card-blur', '14px');

      document.body.style.backgroundImage = `url('${bg}')`;
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundAttachment = 'fixed';

      if (studioId) document.body.setAttribute('data-studio', studioId);
      else document.body.removeAttribute('data-studio');
    })
    .catch(() => {
      document.documentElement.style.setProperty('--primary-color', '#2c2c2c');
      document.documentElement.style.setProperty('--secondary-color', '#fefefe');
      document.documentElement.style.setProperty('--accent-color', '#c9a56c');
      document.documentElement.style.setProperty('--font-family', 'Inter, system-ui, sans-serif');
      document.body.style.backgroundImage = `url('assets/marble-bg.png')`;
    });
}

/** Artists für das aktuelle Studio (Dropdown) */
async function fetchArtistsForStudio() {
  const params = new URLSearchParams(window.location.search);
  const studioId = params.get('studio') || window.DEFAULT_STUDIO || null;
  const url = studioId ? `${API_BASE}/artists?studio=${encodeURIComponent(studioId)}` : `${API_BASE}/artists`;
  const res = await fetch(url);
  return res.ok ? res.json() : [];
}

/** Registrierung (mit Artist-Dropdown) */
function showRegisterForm(clientId) {
  const app = document.getElementById('app');
  app.innerHTML = '';

  fetchArtistsForStudio().then((artists) => {
    const form = document.createElement('div');
    form.className = 'form-container';
    form.innerHTML = `
      <h2>Registrieren</h2>
      <div class="form-group">
        <label>Client-ID</label>
        <input type="text" id="reg-client-id" value="${clientId}" readonly />
      </div>
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="reg-name" placeholder="Dein Name" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="reg-password" placeholder="Passwort" />
      </div>
      <div class="form-group">
        <label>Artist auswählen</label>
        <select id="reg-artist">
          <option value="">Noch kein Artist</option>
          ${artists.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select>
      </div>
      <button id="reg-submit">Registrieren</button>
      <p id="reg-message"></p>
    `;
    app.appendChild(form);

    const btn = form.querySelector('#reg-submit');
    btn.addEventListener('click', () => {
      const name = form.querySelector('#reg-name').value.trim();
      const password = form.querySelector('#reg-password').value;
      const artistId = form.querySelector('#reg-artist').value;
      const studioId = window.__studio || window.DEFAULT_STUDIO || null;

      const m = form.querySelector('#reg-message');
      if (!password) {
        m.textContent = 'Bitte Passwort eingeben';
        m.className = 'error';
        return;
      }

      fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, password, name, artistId, studioId })
      })
        .then((resp) => resp.json())
        .then((data) => {
          if (data.success) {
            m.textContent = 'Registrierung erfolgreich! Du kannst dich nun einloggen.';
            m.className = 'success';
            const qs = studioId ? `?studio=${encodeURIComponent(studioId)}` : '';
            setTimeout(() => { window.location.href = `/index.html${qs}`; }, 1200);
          } else {
            m.textContent = data.error || 'Fehler bei der Registrierung';
            m.className = 'error';
          }
        })
        .catch(() => {
          m.textContent = 'Fehler bei der Registrierung';
          m.className = 'error';
        });
    });
  });
}

/** Erst-Dialog vor Registrierung (Kunden-ID abfragen) */
function showInitialRegister() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const form = document.createElement('div');
  form.className = 'form-container';
  form.innerHTML = `
    <h2>Registrierung starten</h2>
    <div class="form-group">
      <label>Kunden-ID</label>
      <input type="text" id="init-client-id" placeholder="ID vom Studio/QR-Code" />
    </div>
    <button id="init-reg-btn">Weiter</button>
    <button id="init-back-btn" type="button" style="margin-left:0.5rem">Zurück</button>
    <p id="init-msg"></p>
  `;
  app.appendChild(form);

  form.querySelector('#init-reg-btn').addEventListener('click', () => {
    const cid = form.querySelector('#init-client-id').value.trim();
    const msg = form.querySelector('#init-msg');
    if (!cid) {
      msg.textContent = 'Bitte die vom Studio bereitgestellte Kunden-ID eingeben.';
      msg.className = 'error';
      return;
    }
    showRegisterForm(cid);
  });
  form.querySelector('#init-back-btn').addEventListener('click', showLoginForm);
}

/** Login (Kunde/Artist) */
function showLoginForm() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const form = document.createElement('div');
  form.className = 'form-container';
  form.innerHTML = `
    <h2>Login</h2>
    <div class="form-group">
      <label>User-ID</label>
      <input type="text" id="login-user-id" placeholder="Client oder Artist ID" />
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="login-password" placeholder="Passwort" />
    </div>
    <div class="form-group">
      <label>Rolle</label>
      <select id="login-role">
        <option value="client">Kunde</option>
        <option value="artist">Artist</option>
      </select>
    </div>
    <button id="login-submit">Login</button>
    <button id="show-register" type="button" style="margin-left:0.5rem">Neu registrieren</button>
    <p id="login-message"></p>
  `;
  app.appendChild(form);

  form.querySelector('#login-submit').addEventListener('click', () => {
    const userId = form.querySelector('#login-user-id').value.trim();
    const password = form.querySelector('#login-password').value;
    const role = form.querySelector('#login-role').value;
    const studioId = window.__studio || window.DEFAULT_STUDIO || null;

    const m = form.querySelector('#login-message');
    if (!userId || !password) {
      m.textContent = 'Bitte alle Felder ausfüllen';
      m.className = 'error';
      return;
    }
    fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password, role })
    })
      .then((resp) => resp.json())
      .then((data) => {
        if (data.success) {
          if (role === 'client') {
            loadClientDashboard(data.clientId || userId);
          } else {
            const qsStudio = studioId ? `&studio=${encodeURIComponent(studioId)}` : '';
            window.location.href = `/artist.html?artistId=${encodeURIComponent(userId)}${qsStudio}`;
          }
        } else {
          m.textContent = data.error || 'Fehler beim Login';
          m.className = 'error';
        }
      })
      .catch(() => {
        m.textContent = 'Fehler beim Login';
        m.className = 'error';
      });
  });

  form.querySelector('#show-register').addEventListener('click', showInitialRegister);
}

/** Kundendaten laden + Dashboard rendern */
function loadClientDashboard(clientId) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  fetch(`${API_BASE}/client/${clientId}`)
    .then((resp) => resp.json())
    .then((client) => buildClientUI(client))
    .catch((err) => console.error('Fehler beim Laden der Kundendaten', err));
}

/** Kunden-Dashboard (Tabs: Termine, Ideen, Vorlagen, Wanna-Do, Pflege) */
function buildClientUI(client) {
  const app = document.getElementById('app');

  const header = document.createElement('header');
  header.innerHTML = `<h1>Willkommen, ${client.name}</h1>`;
  app.appendChild(header);

  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const tabDefs = [
    { id: 'appointments', title: 'Termine' },
    { id: 'ideas',        title: 'Ideen' },
    { id: 'templates',    title: 'Vorlagen' },
    { id: 'wannado',      title: 'Wanna-Do' },
    { id: 'aftercare',    title: 'Tattoo-Pflege' }
  ];
  tabDefs.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'tab' + (i === 0 ? ' active' : '');
    el.dataset.target = t.id;
    el.textContent = t.title;
    el.addEventListener('click', () => {
      tabs.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      container.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      container.querySelector(`#${t.id}`).classList.add('active');
    });
    tabs.appendChild(el);
  });
  app.appendChild(tabs);

  const container = document.createElement('main');

  // Termine
  const apptSec = document.createElement('div');
  apptSec.id = 'appointments';
  apptSec.className = 'section active';
  apptSec.innerHTML = '<h2>Termine</h2>';
  if (client.appointments?.length) {
    client.appointments
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((appt) => {
        const card = document.createElement('div');
        card.className = 'card';
        const d = new Date(appt.date);
        card.innerHTML = `
          <strong>${d.toLocaleDateString()} – ${appt.type || ''}</strong><br/>
          <span>${appt.description || ''}</span>
        `;
        apptSec.appendChild(card);
      });
  } else {
    apptSec.innerHTML += '<p>Keine Termine vorhanden.</p>';
  }
  container.appendChild(apptSec);

  // Ideen
  const ideasSec = document.createElement('div');
  ideasSec.id = 'ideas';
  ideasSec.className = 'section';
  ideasSec.innerHTML = '<h2>Ideen hochladen</h2>';

  const ideaForm = document.createElement('div');
  ideaForm.innerHTML = `
    <input type="file" id="idea-files" multiple accept="image/*" />
    <button id="idea-upload-btn">Hochladen</button>
    <p id="idea-msg"></p>
  `;
  ideasSec.appendChild(ideaForm);

  const ideaList = document.createElement('div');
  ideaList.className = 'image-list';
  (client.ideas || []).forEach((idea) => {
    const item = document.createElement('div');
    item.className = 'image-item';
    const img = document.createElement('img');
    img.src = toAbs(idea.url || idea.path);
    img.alt = idea.filename || 'Idee';
    item.appendChild(img);
    ideaList.appendChild(item);
  });
  ideasSec.appendChild(ideaList);
  container.appendChild(ideasSec);

  // Upload-Handler (Ideen)
  ideasSec.querySelector('#idea-upload-btn').addEventListener('click', async () => {
    const files = ideasSec.querySelector('#idea-files').files;
    const msg = ideasSec.querySelector('#idea-msg');
    if (!files || !files.length) {
      msg.textContent = 'Bitte Bilder auswählen';
      msg.className = 'error';
      return;
    }
    const base64 = await Promise.all(Array.from(files).map(fileToBase64));
    const images = base64.map((data, i) => ({ name: files[i].name, data }));
    fetch(`${API_BASE}/client/${client.id}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images })
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          msg.textContent = 'Bilder erfolgreich hochgeladen';
          msg.className = 'success';
          loadClientDashboard(client.id);
        } else {
          msg.textContent = d.error || 'Fehler beim Upload';
          msg.className = 'error';
        }
      })
      .catch(() => {
        msg.textContent = 'Fehler beim Upload';
        msg.className = 'error';
      });
  });

  // Vorlagen
  const tmplSec = document.createElement('div');
  tmplSec.id = 'templates';
  tmplSec.className = 'section';
  tmplSec.innerHTML = '<h2>Vorlagen</h2>';

  const tmplList = document.createElement('div');
  tmplList.className = 'image-list';
  if (client.templates?.length) {
    client.templates.forEach((tmpl) => {
      const item = document.createElement('div');
      item.className = 'image-item';
      const img = document.createElement('img');
      img.src = toAbs(tmpl.url || tmpl.path);
      img.alt = tmpl.filename || 'Vorlage';
      item.appendChild(img);

      const ratingDiv = document.createElement('div');
      ratingDiv.className = 'rating-buttons';
      const likeBtn = document.createElement('button');
      likeBtn.textContent = 'Gefällt mir';
      likeBtn.addEventListener('click', () => rateTemplate(client.id, tmpl.id, 'like'));
      const dislikeBtn = document.createElement('button');
      dislikeBtn.textContent = 'Gefällt mir nicht';
      dislikeBtn.addEventListener('click', () => rateTemplate(client.id, tmpl.id, 'dislike'));
      ratingDiv.appendChild(likeBtn);
      ratingDiv.appendChild(dislikeBtn);

      const ratingInfo = document.createElement('span');
      ratingInfo.style.display = 'block';
      ratingInfo.textContent = tmpl.rating ? `Bewertung: ${tmpl.rating}` : '';

      item.appendChild(ratingInfo);
      item.appendChild(ratingDiv);
      tmplList.appendChild(item);
    });
  } else {
    tmplSec.innerHTML += '<p>Noch keine Vorlagen vorhanden.</p>';
  }
  tmplSec.appendChild(tmplList);

  // finale Vorlage
  if (client.finalTemplate) {
    const finalDiv = document.createElement('div');
    finalDiv.className = 'card';
    finalDiv.innerHTML = `<h3>Finale Vorlage</h3>
      <img src="${toAbs(client.finalTemplate.url || client.finalTemplate.path)}"
           alt="Finale Vorlage"
           style="max-width:100%;height:auto;border-radius:4px;" />`;
    tmplSec.appendChild(finalDiv);
  }
  container.appendChild(tmplSec);

  // Wanna-Do (vom zugewiesenen Artist)
  const wdSec = document.createElement('div');
  wdSec.id = 'wannado';
  wdSec.className = 'section';
  wdSec.innerHTML = '<h2>Wanna-Do vom Artist</h2>';
  fetch(`${API_BASE}/client/${client.id}/artist/wannado`)
    .then(r => r.json())
    .then(items => {
      if (!items || !items.length) {
        wdSec.innerHTML += '<p>Noch keine Wanna-Do Motive.</p>';
        return;
      }
      const list = document.createElement('div');
      list.className = 'image-list';
      items.forEach(it => {
        const d = document.createElement('div');
        d.className = 'image-item';
        const img = document.createElement('img');
        img.src = toAbs(it.path || it.url);
        img.alt = it.filename || 'Wanna-Do';
        d.appendChild(img);
        list.appendChild(d);
      });
      wdSec.appendChild(list);
    })
    .catch(() => { wdSec.innerHTML += '<p>Wanna-Do momentan nicht verfügbar.</p>'; });
  container.appendChild(wdSec);

  // Tattoo-Pflege
  const careSec = document.createElement('div');
  careSec.id = 'aftercare';
  careSec.className = 'section';
  careSec.innerHTML = '<h2>Tattoo-Pflege</h2>';
  fetch(`${API_BASE}/aftercare`)
    .then((resp) => resp.json())
    .then((data) => {
      data.tips.forEach((tip) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<strong>${tip.title}</strong><p>${tip.text}</p>`;
        careSec.appendChild(card);
      });
    })
    .catch(() => {});
  const healForm = document.createElement('div');
  healForm.className = 'card';
  healForm.innerHTML = `
    <h3>Heilungsbild hochladen</h3>
    <input type="file" id="heal-files" multiple accept="image/*" />
    <input type="text" id="heal-comment" placeholder="Kommentar (optional)" />
    <button id="heal-upload-btn">Absenden</button>
    <p id="heal-msg"></p>
  `;
  careSec.appendChild(healForm);

  if (client.healing?.length) {
    client.healing
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((entry) => {
        const card = document.createElement('div');
        card.className = 'card';
        const date = new Date(entry.createdAt);
        card.innerHTML = `<strong>Anfrage vom ${date.toLocaleDateString()}</strong><p>${entry.comment || ''}</p>`;

        const imgList = document.createElement('div');
        imgList.className = 'image-list';
        (entry.images || []).forEach((img) => {
          const imgItem = document.createElement('div');
          imgItem.className = 'image-item';
          const im = document.createElement('img');
          im.src = toAbs(img.url || img.path);
          im.alt = img.filename || 'Heilungsbild';
          imgItem.appendChild(im);
          imgList.appendChild(imgItem);
        });
        card.appendChild(imgList);

        if (entry.responses?.length) {
          const respDiv = document.createElement('div');
          respDiv.style.marginTop = '.5rem';
          entry.responses.forEach((resp) => {
            const rdate = new Date(resp.createdAt);
            const p = document.createElement('p');
            p.innerHTML = `<em>Antwort vom ${rdate.toLocaleDateString()}: ${resp.comment}</em>`;
            respDiv.appendChild(p);
          });
          card.appendChild(respDiv);
        }
        careSec.appendChild(card);
      });
  }
  container.appendChild(careSec);

  app.appendChild(container);

  // Heilungsbilder senden
  healForm.querySelector('#heal-upload-btn').addEventListener('click', async () => {
    const files = healForm.querySelector('#heal-files').files;
    const comment = healForm.querySelector('#heal-comment').value;
    const msg = healForm.querySelector('#heal-msg');
    if (!files || !files.length) {
      msg.textContent = 'Bitte Bilder auswählen';
      msg.className = 'error';
      return;
    }
    const base64 = await Promise.all(Array.from(files).map(fileToBase64));
    const images = base64.map((data, i) => ({ name: files[i].name, data }));
    fetch(`${API_BASE}/client/${client.id}/healing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, comment })
    })
      .then((resp) => resp.json())
      .then((data) => {
        if (data.success) {
          msg.textContent = 'Bilder erfolgreich übermittelt';
          msg.className = 'success';
          loadClientDashboard(client.id);
        } else {
          msg.textContent = data.error || 'Fehler beim Upload';
          msg.className = 'error';
        }
      })
      .catch(() => {
        msg.textContent = 'Fehler beim Upload';
        msg.className = 'error';
      });
  });
}

/** Vorlage bewerten */
function rateTemplate(clientId, templateId, rating) {
  fetch(`${API_BASE}/client/${clientId}/templates/${templateId}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating })
  })
    .then((resp) => resp.json())
    .then((data) => {
      if (data.success) loadClientDashboard(clientId);
    })
    .catch((err) => console.error('Fehler beim Bewerten der Vorlage', err));
}
