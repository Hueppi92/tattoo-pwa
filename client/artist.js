// Script für den Artist-Bereich. Künstler verwalten Kunden, Vorlagen,
// Wanna-Do-Galerie und beantworten Heilungsanfragen.

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

/** Studio-Theme laden & anwenden */
function loadStudioConfig(studioId = null) {
  const endpoint = studioId
    ? `${API_BASE}/studio/${studioId}/config`
    : `${API_BASE}/studio/config`;

  return fetch(endpoint)
    .then((resp) => resp.ok ? resp.json() : {})
    .then((cfg) => {
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
    })
    .catch(() => {});
}

/** Einstieg */
document.addEventListener('DOMContentLoaded', () => {
  const params   = new URLSearchParams(window.location.search);
  const studioId = params.get('studio') || window.DEFAULT_STUDIO || null;
  const artistId = params.get('artistId');

  loadStudioConfig(studioId).finally(() => {
    if (!artistId) {
      const qs = studioId ? `?studio=${encodeURIComponent(studioId)}` : '';
      // Zur Artist-Loginseite (statt Kunden-Login)
      window.location.href = `/artist-login.html${qs}`;
      return;
    }
    loadArtistDashboard(artistId);
  });
});

/** Dashboard-Startseite für Artist (mit Tabs) */
function loadArtistDashboard(artistId) {
  const app = document.getElementById('artist-app');
  app.innerHTML = '';

  const header = document.createElement('header');
  header.innerHTML = `<h1>Artist-Bereich</h1><p>Angemeldet als ${artistId}</p>`;
  app.appendChild(header);

  const main = document.createElement('main');
  app.appendChild(main);

  renderArtistTabs(main, artistId);
}

/** Tabs: Termine | Kunden | Wanna-Do */
function renderArtistTabs(container, artistId) {
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  tabs.innerHTML = `
    <div class="tab active" data-t="apts">Termine</div>
    <div class="tab" data-t="clients">Kunden</div>
    <div class="tab" data-t="wannado">Wanna-Do</div>
  `;
  container.appendChild(tabs);

  const secA = document.createElement('section'); secA.className='section active'; secA.id='sec-apts';
  const secB = document.createElement('section'); secB.className='section';        secB.id='sec-clients';
  const secC = document.createElement('section'); secC.className='section';        secC.id='sec-wannado';
  container.appendChild(secA); container.appendChild(secB); container.appendChild(secC);

  // Termine laden
  fetch(`${API_BASE}/artist/${artistId}/appointments`).then(r=>r.json()).then(list=>{
    secA.innerHTML = '<h2>Termine</h2>';
    if (!list.length) { secA.innerHTML += '<p>Keine Termine.</p>'; return; }
    list.forEach(a=>{
      const card = document.createElement('div'); card.className='card';
      const d = new Date(a.date);
      card.innerHTML = `<strong>${d.toLocaleDateString()} – ${a.type || ''}</strong>
                        <div>${a.clientName} (${a.clientId})</div>
                        <div>${a.description || ''}</div>`;
      secA.appendChild(card);
    });
  });

  // Kundenliste
  secB.innerHTML = '<h2>Meine Kunden</h2>';
  fetch(`${API_BASE}/artist/${artistId}/clients`).then(r=>r.json()).then(clients=>{
    if (!clients.length) { secB.innerHTML += '<p>Keine zugewiesenen Kunden.</p>'; return; }
    const list = document.createElement('div');
    clients.forEach(c=>{
      const card = document.createElement('div'); card.className='card'; card.style.cursor='pointer';
      card.innerHTML = `<strong>${c.name}</strong><br/><span>ID: ${c.id}</span>`;
      card.addEventListener('click',()=> showClientDetails(artistId, c.id));
      list.appendChild(card);
    });
    secB.appendChild(list);
  });

  // Wanna-Do: Upload + Galerie
  secC.innerHTML = `
    <h2>Wanna-Do Galerie</h2>
    <div class="card">
      <input type="file" id="wd-files" multiple accept="image/*" />
      <button id="wd-upload">Hochladen</button>
      <p id="wd-msg"></p>
    </div>
    <div id="wd-list" class="image-list"></div>
  `;
  const renderWD = ()=> {
    fetch(`${API_BASE}/artist/${artistId}/wannado`).then(r=>r.json()).then(items=>{
      const list = document.getElementById('wd-list');
      list.innerHTML = '';
      items.forEach(it=>{
        const item = document.createElement('div'); item.className='image-item';
        const img = document.createElement('img'); img.src = toAbs(it.path); img.alt = it.filename || 'Wanna-Do';
        item.appendChild(img); list.appendChild(item);
      });
    });
  };
  renderWD();

  secC.querySelector('#wd-upload').addEventListener('click', async ()=>{
    const files = secC.querySelector('#wd-files').files;
    const msg = secC.querySelector('#wd-msg');
    if (!files || !files.length) { msg.textContent='Bitte Dateien wählen'; msg.className='error'; return; }
    const base64 = await Promise.all(Array.from(files).map(fileToBase64));
    const images = base64.map((data, i)=>({ name: files[i].name, data }));
    const res = await fetch(`${API_BASE}/artist/${artistId}/wannado`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ images })
    }).then(r=>r.json()).catch(()=>({}));
    if (res && res.success) { msg.textContent='Hochgeladen'; msg.className='success'; renderWD(); }
    else { msg.textContent='Upload fehlgeschlagen'; msg.className='error'; }
  });

  // Tab switching
  tabs.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>{
      tabs.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      const target = t.dataset.t;
      [secA,secB,secC].forEach(s=>s.classList.remove('active'));
      document.getElementById(`sec-${target}`).classList.add('active');
    });
  });
}

/** Kunden-Detailansicht: Ideen, Vorlagen, Finale, Heilung */
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
  app.appendChild(main);

  // Kundendaten
  fetch(`${API_BASE}/client/${clientId}`)
    .then((resp) => resp.json())
    .then((client) => {
      main.innerHTML = `<h2>${client.name}</h2>`;

      // Ideen ansehen
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

      // Finale Vorlage setzen
      const finalSec = document.createElement('div');
      finalSec.className = 'card';
      finalSec.innerHTML = `
        <h3>Finale Vorlage setzen</h3>
        <input type="file" id="final-file" accept="image/*" />
        <button id="final-upload-btn">Festlegen</button>
        <p id="final-msg"></p>
      `;
      main.appendChild(finalSec);

      // Bisherige Vorlagen
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

      // Heilungsanfragen
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

            const imgList = document.createElement('div');
            imgList.className = 'image-list';
            (entry.images || []).forEach((img) => {
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

      // Events: Vorlagen hochladen
      main.querySelector('#tmpl-upload-btn').addEventListener('click', async () => {
        const files = main.querySelector('#tmpl-files').files;
        const m = main.querySelector('#tmpl-msg');
        if (!files || !files.length) { m.textContent='Bitte Dateien auswählen'; m.className='error'; return; }
        const base64Files = await Promise.all(Array.from(files).map(fileToBase64));
        const templates = base64Files.map((data, idx) => ({ name: files[idx].name, data }));
        fetch(`${API_BASE}/client/${clientId}/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templates })
        })
          .then((resp) => resp.json())
          .then((data) => {
            if (data.success) { m.textContent='Vorlagen hochgeladen'; m.className='success'; showClientDetails(artistId, clientId); }
            else { m.textContent=data.error || 'Fehler beim Upload'; m.className='error'; }
          })
          .catch(() => { m.textContent='Fehler beim Upload'; m.className='error'; });
      });

      // Events: Finale Vorlage
      main.querySelector('#final-upload-btn').addEventListener('click', async () => {
        const input = main.querySelector('#final-file');
        const m = main.querySelector('#final-msg');
        const file = input.files[0];
        if (!file) { m.textContent = 'Bitte eine Datei auswählen'; m.className='error'; return; }
        const dataUrl = await fileToBase64(file);
        const final = { name: file.name, data: dataUrl };
        fetch(`${API_BASE}/client/${clientId}/final`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ final })
        })
          .then((resp) => resp.json())
          .then((data) => {
            if (data.success) { m.textContent='Finale Vorlage gespeichert'; m.className='success'; showClientDetails(artistId, clientId); }
            else { m.textContent=data.error || 'Fehler beim Upload'; m.className='error'; }
          })
          .catch(() => { m.textContent='Fehler beim Upload'; m.className='error'; });
      });
    })
    .catch((err) => {
      console.error('Fehler beim Laden der Kundendaten', err);
    });
}
