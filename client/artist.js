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
          item.className = 'image-item';
          const img = document.createElement('img');
          img.src = toAbs(tmpl.url || tmpl.path);
          img.alt = tmpl.filename || 'Vorlage';
          item.appendChild(img);
          // Zeige Bewertung des Kunden
          const rating = document.createElement('span');
          rating.style.display = 'block';
          rating.textContent = tmpl.rating ? `Bewertung: ${tmpl.rating}` : '';
          item.appendChild(rating);
          list.appendChild(item);
        });
        tmplSec.appendChild(list);
      } else {
        tmplSec.innerHTML += '<p>Keine Vorlagen vorhanden.</p>';
      }

      // Finale Vorlage anzeigen
      if (client.finalTemplate) {
        const finalShow = document.createElement('div');
        finalShow.className = 'card';
        finalShow.innerHTML = `<h3>Finale Vorlage</h3>
          <img src="${toAbs(client.finalTemplate.url || client.finalTemplate.path)}"
               alt="Final"
               style="max-width:100%;height:auto;border-radius:4px;" />`;
        tmplSec.appendChild(finalShow);
      }
      main.appendChild(tmplSec);

      // Heilungsanfragen anzeigen
      const healSec = document.createElement('div');
      healSec.className = 'card';
      healSec.innerHTML = '<h3>Heilungsanfragen</h3>';
      if (client.healing && client.healing.length > 0) {
        client.healing
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .forEach((entry) => {
            const card = document.createElement('div');
            card.className = 'card';
            const date = new Date(entry.createdAt);
            card.innerHTML = `<strong>Anfrage vom ${date.toLocaleDateString()}</strong><p>${entry.comment || ''}</p>`;
            // Bilder
            const imgList = document.createElement('div');
            imgList.className = 'image-list';
            entry.images.forEach((img) => {
              const item = document.createElement('div');
              item.className = 'image-item';
              const im = document.createElement('img');
              im.src = toAbs(img.url || img.path);
              im.alt = img.filename || 'Heilungsbild';
              item.appendChild(im);
              imgList.appendChild(item);
            });
            card.appendChild(imgList);
            // Vorhandene Antworten
            if (entry.responses && entry.responses.length > 0) {
              entry.responses.forEach((resp) => {
                const rdate = new Date(resp.createdAt);
                const p = document.createElement('p');
                p.innerHTML = `<em>Antwort vom ${rdate.toLocaleDateString()}: ${resp.comment}</em>`;
                card.appendChild(p);
              });
            }
            // Antwortformular
            const respInput = document.createElement('input');
            respInput.type = 'text';
            respInput.placeholder = 'Antwort eingeben';
            respInput.style.width = '100%';
            const respBtn = document.createElement('button');
            respBtn.textContent = 'Antwort senden';
            const msg = document.createElement('p');
            respBtn.addEventListener('click', () => {
              const comment = respInput.value.trim();
              if (!comment) return;
              fetch(`${API_BASE}/client/${clientId}/healing/${entry.id}/response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artistId, comment })
              })
                .then((resp) => resp.json())
                .then((data) => {
                  if (data.success) {
                    msg.textContent = 'Antwort gespeichert';
                    msg.className = 'success';
                    showClientDetails(artistId, clientId);
                  } else {
                    msg.textContent = data.error || 'Fehler beim Speichern';
                    msg.className = 'error';
                  }
                })
                .catch((err) => {
                  msg.textContent = 'Fehler beim Speichern';
                  msg.className = 'error';
                  console.error(err);
                });
            });
            card.appendChild(respInput);
            card.appendChild(respBtn);
            card.appendChild(msg);
            healSec.appendChild(card);
          });
      } else {
        healSec.innerHTML += '<p>Keine Heilungsanfragen.</p>';
      }
      main.appendChild(healSec);
      app.appendChild(main);

      // Eventlistener für Upload von Vorlagen
      document.getElementById('tmpl-upload-btn').addEventListener('click', () => {
        const files = document.getElementById('tmpl-files').files;
        if (!files || files.length === 0) {
          document.getElementById('tmpl-msg').textContent = 'Bitte Dateien auswählen';
          document.getElementById('tmpl-msg').className = 'error';
          return;
        }
        Promise.all(Array.from(files).map((file) => fileToBase64(file))).then((base64Files) => {
          const templates = base64Files.map((data, idx) => ({ name: files[idx].name, data }));
          fetch(`${API_BASE}/client/${clientId}/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templates })
          })
            .then((resp) => resp.json())
            .then((data) => {
              if (data.success) {
                document.getElementById('tmpl-msg').textContent = 'Vorlagen hochgeladen';
                document.getElementById('tmpl-msg').className = 'success';
                showClientDetails(artistId, clientId);
              } else {
                document.getElementById('tmpl-msg').textContent = data.error || 'Fehler beim Upload';
                document.getElementById('tmpl-msg').className = 'error';
              }
            })
            .catch((err) => {
              document.getElementById('tmpl-msg').textContent = 'Fehler beim Upload';
              document.getElementById('tmpl-msg').className = 'error';
              console.error(err);
            });
        });
      });

      // Eventlistener für finalen Upload
      document.getElementById('final-upload-btn').addEventListener('click', () => {
        const fileInput = document.getElementById('final-file');
        const file = fileInput.files[0];
        if (!file) {
          document.getElementById('final-msg').textContent = 'Bitte eine Datei auswählen';
          document.getElementById('final-msg').className = 'error';
          return;
        }
        fileToBase64(file).then((dataUrl) => {
          const final = { name: file.name, data: dataUrl };
          fetch(`${API_BASE}/client/${clientId}/final`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ final })
          })
            .then((resp) => resp.json())
            .then((data) => {
              if (data.success) {
                document.getElementById('final-msg').textContent = 'Finale Vorlage gespeichert';
                document.getElementById('final-msg').className = 'success';
                showClientDetails(artistId, clientId);
              } else {
                document.getElementById('final-msg').textContent = data.error || 'Fehler beim Upload';
                document.getElementById('final-msg').className = 'error';
              }
            })
            .catch((err) => {
              document.getElementById('final-msg').textContent = 'Fehler beim Upload';
              document.getElementById('final-msg').className = 'error';
              console.error(err);
            });
        });
      });
    })
    .catch((err) => {
      console.error('Fehler beim Laden der Kundendaten', err);
    });
}
