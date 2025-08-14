// Hauptskript für die Tattoo‑PWA. Dieses Modul kümmert sich um die
// Darstellung der verschiedenen Seiten (Login, Registrierung, Dashboard) und
// den Austausch mit der REST‑API.

const API_BASE = 'http://localhost:3001/api';

/**
 * Liest eine Datei und gibt sie als Data‑URL (Base64) zurück.
 * @param {File} file
 * @returns {Promise<string>}
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// --- Am Anfang bleibt API_BASE etc. wie gehabt ---

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  // Studio aus der URL holen; falls keins angegeben, neutraler Fallback
  const studioId = params.get('studio') || null;
  window.__studio = studioId;

  // Theme laden + anwenden, DANN Seite rendern
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

/**
 * Lädt (optional) das Theme eines Studios und setzt CSS-Variablen + BG.
 * @param {string|null} studioId
 */
function loadStudioConfig(studioId = null) {
  const endpoint = studioId
    ? `${API_BASE}/studio/${studioId}/config`
    : `${API_BASE}/studio/config`;

  return fetch(endpoint)
    .then((resp) => resp.ok ? resp.json() : {})
    .then((cfg) => {
      // Fallbacks, falls Keys fehlen
      const primary   = cfg.primaryColor   || '#2c2c2c';
      const secondary = cfg.secondaryColor || '#fefefe';
      const accent    = cfg.accentColor    || '#c9a56c';
      const fontBody  = cfg.fontBody       || "Inter, system-ui, sans-serif";
      const bg        = cfg.bg             || 'assets/marble-bg.png';

      document.documentElement.style.setProperty('--primary-color', primary);
      document.documentElement.style.setProperty('--secondary-color', secondary);
      document.documentElement.style.setProperty('--accent-color', accent);
      document.documentElement.style.setProperty('--font-family', fontBody);

      // Glass-Card Variablen kannst du je nach Studio auch differenzieren
      document.documentElement.style.setProperty('--card-bg', 'rgba(255,255,255,0.20)');
      document.documentElement.style.setProperty('--card-border', 'rgba(255,255,255,0.40)');
      document.documentElement.style.setProperty('--card-blur', '14px');

      // Hintergrund anwenden
      document.body.style.backgroundImage = `url('${bg}')`;
      document.body.style.backgroundRepeat = 'no-repeat';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundAttachment = 'fixed';

      // Optional: für CSS-Selektoren das Studio als Datensatz auf <body>
      if (studioId) {
        document.body.setAttribute('data-studio', studioId);
      } else {
        document.body.removeAttribute('data-studio');
      }
    })
    .catch(() => {
      // Bei Fehlern wenigstens eine neutrale Basis setzen
      document.documentElement.style.setProperty('--primary-color', '#2c2c2c');
      document.documentElement.style.setProperty('--secondary-color', '#fefefe');
      document.documentElement.style.setProperty('--accent-color', '#c9a56c');
      document.documentElement.style.setProperty('--font-family', "Inter, system-ui, sans-serif");
      document.body.style.backgroundImage = `url('assets/marble-bg.png')`;
    });
}


/**
 * Zeigt das Registrierungsformular für einen neuen Client.
 * @param {string} clientId
 */
function showRegisterForm(clientId) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const form = document.createElement('div');
  form.className = 'form-container';
  form.innerHTML = `
    <h2>Registrieren</h2>
    <div class="form-group">
      <label>Client‑ID</label>
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
      <label>Artist‑ID</label>
      <input type="text" id="reg-artist-id" placeholder="Zugewiesener Artist (optional)" />
    </div>
    <button id="reg-submit">Registrieren</button>
    <p id="reg-message"></p>
  `;
  app.appendChild(form);
  document.getElementById('reg-submit').addEventListener('click', () => {
    const name = document.getElementById('reg-name').value.trim();
    const password = document.getElementById('reg-password').value;
    const artistId = document.getElementById('reg-artist-id').value.trim();
    if (!password) {
      document.getElementById('reg-message').textContent = 'Bitte Passwort eingeben';
      document.getElementById('reg-message').className = 'error';
      return;
    }
    fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, password, name, artistId })
    })
      .then((resp) => resp.json())
      .then((data) => {
        if (data.success) {
          document.getElementById('reg-message').textContent = 'Registrierung erfolgreich! Du kannst dich nun einloggen.';
          document.getElementById('reg-message').className = 'success';
          setTimeout(() => {
            window.location.href = '/index.html';
          }, 2000);
        } else if (data.error) {
          document.getElementById('reg-message').textContent = data.error;
          document.getElementById('reg-message').className = 'error';
        }
      })
      .catch((err) => {
        document.getElementById('reg-message').textContent = 'Fehler bei der Registrierung';
        document.getElementById('reg-message').className = 'error';
        console.error(err);
      });
  });
}

/**
 * Zeigt eine Eingabeseite an, auf der der Nutzer zunächst seine Kunden‑ID
 * eingibt. Nach Bestätigung wird das eigentliche Registrierungsformular
 * angezeigt. Diese Funktion wird von der Login‑Seite aus aufgerufen.
 */
function showInitialRegister() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const form = document.createElement('div');
  form.className = 'form-container';
  form.innerHTML = `
    <h2>Registrierung starten</h2>
    <div class="form-group">
      <label>Kunden‑ID</label>
      <input type="text" id="init-client-id" placeholder="ID vom Studio/QR‑Code" />
    </div>
    <button id="init-reg-btn">Weiter</button>
    <button id="init-back-btn" type="button" style="margin-left:0.5rem">Zurück</button>
    <p id="init-msg"></p>
  `;
  app.appendChild(form);
  document.getElementById('init-reg-btn').addEventListener('click', () => {
    const cid = document.getElementById('init-client-id').value.trim();
    if (!cid) {
      const msg = document.getElementById('init-msg');
      msg.textContent = 'Bitte die vom Studio bereitgestellte Kunden‑ID eingeben.';
      msg.className = 'error';
      return;
    }
    showRegisterForm(cid);
  });
  document.getElementById('init-back-btn').addEventListener('click', () => {
    showLoginForm();
  });
}

/**
 * Zeigt das Login‑Formular. Je nach ausgewählter Rolle (client/artist) wird
 * entweder das Kundendashboard oder die Artist‑Seite geladen.
 */
function showLoginForm() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const form = document.createElement('div');
  form.className = 'form-container';
  form.innerHTML = `
    <h2>Login</h2>
    <div class="form-group">
      <label>User‑ID</label>
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
  document.getElementById('login-submit').addEventListener('click', () => {
    const userId = document.getElementById('login-user-id').value.trim();
    const password = document.getElementById('login-password').value;
    const role = document.getElementById('login-role').value;
    if (!userId || !password) {
      document.getElementById('login-message').textContent = 'Bitte alle Felder ausfüllen';
      document.getElementById('login-message').className = 'error';
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
            // Artist‑Login: lade artist.html mit Parameter
            window.location.href = `/artist.html?artistId=${encodeURIComponent(userId)}`;
          }
        } else {
          document.getElementById('login-message').textContent = data.error || 'Fehler beim Login';
          document.getElementById('login-message').className = 'error';
        }
      })
      .catch((err) => {
        document.getElementById('login-message').textContent = 'Fehler beim Login';
        document.getElementById('login-message').className = 'error';
        console.error(err);
      });
  });

  // Navigiert zur Registrierung, indem zunächst die Client‑ID abgefragt wird
  document.getElementById('show-register').addEventListener('click', () => {
    showInitialRegister();
  });
}

/**
 * Lädt das Dashboard des Kunden und baut die Oberfläche auf.
 * @param {string} clientId
 */
function loadClientDashboard(clientId) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  // Lade Kundendaten vom Server
  fetch(`${API_BASE}/client/${clientId}`)
    .then((resp) => resp.json())
    .then((client) => {
      buildClientUI(client);
    })
    .catch((err) => {
      console.error('Fehler beim Laden der Kundendaten', err);
    });
}

/**
 * Baut die UI für den Kunden anhand der geladenen Daten auf.
 * @param {object} client
 */
function buildClientUI(client) {
  const app = document.getElementById('app');
  // Header
  const header = document.createElement('header');
  header.innerHTML = `<h1>Willkommen, ${client.name}</h1>`;
  app.appendChild(header);
  // Tabs
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const tabNames = [
    { id: 'appointments', title: 'Termine' },
    { id: 'ideas', title: 'Ideen' },
    { id: 'templates', title: 'Vorlagen' },
    { id: 'aftercare', title: 'Tattoo‑Pflege' }
  ];
  tabNames.forEach((t, idx) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (idx === 0 ? ' active' : '');
    tab.textContent = t.title;
    tab.dataset.target = t.id;
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.section').forEach((sec) => (sec.classList.remove('active')));
      document.getElementById(t.id).classList.add('active');
    });
    tabs.appendChild(tab);
  });
  app.appendChild(tabs);
  // Sections container
  const container = document.createElement('main');
  // Termine
  const apptSec = document.createElement('div');
  apptSec.id = 'appointments';
  apptSec.className = 'section active';
  apptSec.innerHTML = '<h2>Termine</h2>';
  if (client.appointments && client.appointments.length > 0) {
    client.appointments
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((appt) => {
        const card = document.createElement('div');
        card.className = 'card';
        const date = new Date(appt.date);
        card.innerHTML = `
          <strong>${date.toLocaleDateString()} – ${appt.type}</strong><br />
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
  // Upload‑Formular
  const ideaForm = document.createElement('div');
  ideaForm.innerHTML = `
    <input type="file" id="idea-files" multiple accept="image/*" />
    <button id="idea-upload-btn">Hochladen</button>
    <p id="idea-msg"></p>
  `;
  ideasSec.appendChild(ideaForm);
  // Liste der hochgeladenen Ideen
  const ideaList = document.createElement('div');
  ideaList.className = 'image-list';
  if (client.ideas && client.ideas.length > 0) {
    client.ideas.forEach((idea) => {
      const item = document.createElement('div');
      item.className = 'image-item';
      const img = document.createElement('img');
      img.src = idea.url || idea.path;
      img.alt = idea.filename;
      item.appendChild(img);
      ideaList.appendChild(item);
    });
  }
  ideasSec.appendChild(ideaList);
  container.appendChild(ideasSec);
  // Upload-Handler
  document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'idea-upload-btn') {
      const fileInput = document.getElementById('idea-files');
      const files = fileInput.files;
      if (!files || files.length === 0) {
        document.getElementById('idea-msg').textContent = 'Bitte Bilder auswählen';
        document.getElementById('idea-msg').className = 'error';
        return;
      }
      // Dateien als Base64 lesen
      Promise.all(Array.from(files).map((file) => fileToBase64(file))).then((base64Files) => {
        const images = base64Files.map((data, idx) => ({ name: files[idx].name, data }));
        fetch(`${API_BASE}/client/${client.id}/ideas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images })
        })
          .then((resp) => resp.json())
          .then((data) => {
            if (data.success) {
              document.getElementById('idea-msg').textContent = 'Bilder erfolgreich hochgeladen';
              document.getElementById('idea-msg').className = 'success';
              loadClientDashboard(client.id);
            } else {
              document.getElementById('idea-msg').textContent = data.error || 'Fehler beim Upload';
              document.getElementById('idea-msg').className = 'error';
            }
          })
          .catch((err) => {
            document.getElementById('idea-msg').textContent = 'Fehler beim Upload';
            document.getElementById('idea-msg').className = 'error';
            console.error(err);
          });
      });
    }
  });
  // Vorlagen
  const tmplSec = document.createElement('div');
  tmplSec.id = 'templates';
  tmplSec.className = 'section';
  tmplSec.innerHTML = '<h2>Vorlagen</h2>';
  // Liste der Vorlagen
  const tmplList = document.createElement('div');
  tmplList.className = 'image-list';
  if (client.templates && client.templates.length > 0) {
    client.templates.forEach((tmpl) => {
      const item = document.createElement('div');
      item.className = 'image-item';
      const img = document.createElement('img');
      img.src = tmpl.url || tmpl.path;
      img.alt = tmpl.filename;
      item.appendChild(img);
      // Bewertungsbuttons
      const ratingDiv = document.createElement('div');
      ratingDiv.className = 'rating-buttons';
      const likeBtn = document.createElement('button');
      likeBtn.textContent = 'Gefällt mir';
      likeBtn.addEventListener('click', () => {
        rateTemplate(client.id, tmpl.id, 'like');
      });
      const dislikeBtn = document.createElement('button');
      dislikeBtn.textContent = 'Gefällt mir nicht';
      dislikeBtn.addEventListener('click', () => {
        rateTemplate(client.id, tmpl.id, 'dislike');
      });
      ratingDiv.appendChild(likeBtn);
      ratingDiv.appendChild(dislikeBtn);
      // Anzeige des Ratings
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
  // finale Vorlage anzeigen
  if (client.finalTemplate) {
    const finalDiv = document.createElement('div');
    finalDiv.className = 'card';
    finalDiv.innerHTML = `<h3>Finale Vorlage</h3><img src="${client.finalTemplate.url || client.finalTemplate.path}" alt="Finale Vorlage" style="max-width:100%;height:auto;border-radius:4px;" />`;
    tmplSec.appendChild(finalDiv);
  }
  container.appendChild(tmplSec);
  // Tattoo‑Pflege
  const careSec = document.createElement('div');
  careSec.id = 'aftercare';
  careSec.className = 'section';
  careSec.innerHTML = '<h2>Tattoo‑Pflege</h2>';
  // Aftercare‑Tipps laden
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
    .catch((err) => console.error('Fehler beim Laden der Aftercare‑Tipps', err));
  // Formular zum Hochladen von Heilungsbildern
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
  // Liste der Heilungsanfragen anzeigen
  if (client.healing && client.healing.length > 0) {
    client.healing
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((entry) => {
        const card = document.createElement('div');
        card.className = 'card';
        const date = new Date(entry.createdAt);
        card.innerHTML = `<strong>Anfrage vom ${date.toLocaleDateString()}</strong><p>${entry.comment || ''}</p>`;
        // Bildergalerie
        const imgList = document.createElement('div');
        imgList.className = 'image-list';
        entry.images.forEach((img) => {
          const imgItem = document.createElement('div');
          imgItem.className = 'image-item';
          const im = document.createElement('img');
          im.src = img.url || img.path;
          im.alt = img.filename;
          imgItem.appendChild(im);
          imgList.appendChild(imgItem);
        });
        card.appendChild(imgList);
        // Antworten anzeigen
        if (entry.responses && entry.responses.length > 0) {
          const respDiv = document.createElement('div');
          respDiv.style.marginTop = '0.5rem';
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
  // Eventlistener für Heilungsupload
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'heal-upload-btn') {
      const files = document.getElementById('heal-files').files;
      const comment = document.getElementById('heal-comment').value;
      if (!files || files.length === 0) {
        document.getElementById('heal-msg').textContent = 'Bitte Bilder auswählen';
        document.getElementById('heal-msg').className = 'error';
        return;
      }
      Promise.all(Array.from(files).map((file) => fileToBase64(file))).then((base64Files) => {
        const images = base64Files.map((data, idx) => ({ name: files[idx].name, data }));
        fetch(`${API_BASE}/client/${client.id}/healing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images, comment })
        })
          .then((resp) => resp.json())
          .then((data) => {
            if (data.success) {
              document.getElementById('heal-msg').textContent = 'Bilder erfolgreich übermittelt';
              document.getElementById('heal-msg').className = 'success';
              loadClientDashboard(client.id);
            } else {
              document.getElementById('heal-msg').textContent = data.error || 'Fehler beim Upload';
              document.getElementById('heal-msg').className = 'error';
            }
          })
          .catch((err) => {
            document.getElementById('heal-msg').textContent = 'Fehler beim Upload';
            document.getElementById('heal-msg').className = 'error';
            console.error(err);
          });
      });
    }
  });
}

/**
 * Bewertet eine Vorlage und sendet das Ergebnis an den Server.
 * @param {string} clientId
 * @param {string} templateId
 * @param {string} rating
 */
function rateTemplate(clientId, templateId, rating) {
  fetch(`${API_BASE}/client/${clientId}/templates/${templateId}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating })
  })
    .then((resp) => resp.json())
    .then((data) => {
      if (data.success) {
        loadClientDashboard(clientId);
      }
    })
    .catch((err) => console.error('Fehler beim Bewerten der Vorlage', err));
}