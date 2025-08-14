// Script für den Artist-Bereich. Künstler können hier ihre Kunden
// verwalten, Vorlagen hochladen und auf Heilungsanfragen reagieren.

const API_BASE   = window.API_BASE || 'http://localhost:3001/api';
const API_ORIGIN = API_BASE.replace(/\/api$/, '');
const toAbs = (p) => (p && p.startsWith('/uploads/')) ? `${API_ORIGIN}${p}` : p;

/**
 * Liest eine Datei und gibt sie als Data-URL (Base64) zurück.
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

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const studioId = params.get('studio') || window.DEFAULT_STUDIO || null;

  // Theme konfigurieren (multi-tenant aware)
  loadStudioConfig(studioId);

  const artistId = params.get('artistId');
  if (!artistId) {
    // zurück zur Login-Seite, Studio-ID beibehalten
    const qs = studioId ? `?studio=${encodeURIComponent(studioId)}` : '';
    window.location.href = `/index.html${qs}`;
    return;
  }
  loadArtistDashboard(artistId);
});

function loadStudioConfig(studioId = null) {
  const endpoint = studioId
    ? `${API_BASE}/studio/${studioId}/config`
    : `${API_BASE}/studio/config`;

  fetch(endpoint)
    .then((resp) => resp.ok ? resp.json() : {})
    .then((config) => {
      if (config.primaryColor)   document.documentElement.style.setProperty('--primary-color', config.primaryColor);
      if (config.secondaryColor) document.documentElement.style.setProperty('--secondary-color', config.secondaryColor);
      if (config.accentColor)    document.documentElement.style.setProperty('--accent-color', config.accentColor);
      if (config.fontBody)       document.documentElement.style.setProperty('--font-family', config.fontBody);
      if (config.bg) {
        document.body.style.backgroundImage = `url('${config.bg}')`;
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
      }
    })
    .catch((err) => console.error('Fehler beim Laden der Studio-Konfiguration:', err));
}

/**
 * Lädt die Artist-UI mit der Liste der Kunden.
 * @param {string} artistId
 */
function loadArtistDashboard(artistId) {
  const app = document.getElementById('artist-app');
  app.innerHTML = '';
  // Header
  const header = document.createElement('header');
  header.innerHTML = `<h1>Artist-Bereich</h1><p>Angemeldet als ${artistId}</p>`;
  app.appendChild(header);
  // Container
  const main = document.createElement('main');
  main.innerHTML = '<h2>Meine Kunden</h2>';
  // Liste der Clients laden
  fetch(`${API_BASE}/artist/clients`)
    .then((resp) => resp.json())
    .then((clients) => {
      const list = document.createElement('div');
      clients
        .filter((c) => !c.artistId || c.artistId === artistId)
        .forEach((client) => {
          const card = document.createElement('div');
          card.className = 'card';
          card.style.cursor = 'pointer';
          card.innerHTML = `<strong>${client.name}</strong><br /><span>ID: ${client.id}</span>`;
          card.addEventListener('click', () => {
            showClientDetails(artistId, client.id);
          });
          list.appendChild(card);
        });
      if (list.children.length === 0) {
        main.innerHTML += '<p>Keine zugewiesenen Kunden.</p>';
      } else {
        main.appendChild(list);
      }
    })
    .catch((err) => {
      console.error('Fehler beim Laden der Clients', err);
    });
  app.appendChild(main);
}

/**
 * Zeigt die Details eines ausgewählten Kunden und ermöglicht dem Artist das
 * Hochladen von Vorlagen, das Setzen einer finalen Vorlage sowie das
 * Kommentieren von Heilungsanfragen.
 * @param {string} artistId
 * @param {string} clientId
 */
function showClientDetails(artistId, clientId) {
  const app = document.getElementById('artist-app');
  app.innerHTML = '';
  const header = document.createElement('header');
  header.innerHTML = `<h1>Artist-Bereich</h1><button id="back-btn">Zurück</button>`;
  app.appendChild(header);
  document.getElementById('back-btn').addEventListener('click', () => {
    loadArtistDashboard(artistId);
  });
  const main = document.createElement('main');
  // Kundendaten laden
  fetch(`${API_BASE}/client/${clientId}`)
    .then((resp) => resp.json())
    .then((client) => {
      main.innerHTML = `<h2>${client.name}</h2>`;

      // Ideen anzeigen
      const ideaSec = document.createElement('div');
      ideaSec.className = 'card';
      ideaSec.innerHTML = '<h3>Ideen des Kunden</h3>';
      if (client.ideas && client.ideas.length > 0) {
        const ideaList = document.createElement('div');
        ideaList.className = 'image-list';
        client.ideas.forEach((idea) => {
          const item = document.createElement('div');
          item.className = 'image-item';
          const img = document.createElement('img');
          img.src = toAbs(idea.url || idea.path);
          img.alt = idea.filename || 'Idee';
          item.appendChild(img);
          ideaList.appendChild(item);
        });
        ideaSec.appendChild(ideaList);
      } else {
        ideaSec.innerHTML += '<p>Keine Ideen hochgeladen.</p>';
      }
      main.appendChild(ideaSec);

      // Vorlagen hochladen
      const uploadSec = document.createElement('div');
      uploadSec.className = 'card';
      uploadSec.innerHTML = `
        <h3>Vorlagen hochladen</h3>
        <input type="file" id="tmpl-files" multiple accept="image/*" />
        <button id="tmpl-upload-btn">Hochladen</button>
        <p id="tmpl-msg"></p>
      `;
      main.appendChild(uploadSec);

      // Finale Vorlage hochladen
      const finalSec = document.createElement('div');
      finalSec.className = 'card';
      finalSec.innerHTML = `
        <h3>Finale Vorlage setzen</h3>
        <input type="file" id="final-file" accept="image/*" />
        <button id="final-upload-btn">Festlegen</button>
        <p id="final-msg"></p>
      `;
      main.appendChild(finalSec);

      // Bisherige Vorlagen anzeigen
      const tmplSec = document.createElement('div');
      tmplSec.className = 'card';
      tmplSec.innerHTML = '<h3>Bereits hochgeladene Vorlagen</h3>';
      if (client.templates && client.templates.length > 0) {
        const list = document.createElement('div');
        list.className = 'image-list';
        client.templates.forEach((tmpl) => {
          const item = document.createElement('div');
          item.className = '
