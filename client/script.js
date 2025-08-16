// client/script.js
import { endpoint } from './config.js';

/* ===========================
   Utilities
=========================== */
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
const exists = (sel, root = document) => !!qs(sel, root);

function toast(msg, type = 'info') {
  // Simple toast (inline). Ersetzt ggf. durch dein UI-Framework.
  let box = qs('#toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    Object.assign(box.style, {
      position: 'fixed', right: '16px', bottom: '16px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      zIndex: '9999'
    });
    document.body.appendChild(box);
  }
  const item = document.createElement('div');
  Object.assign(item.style, {
    padding: '10px 12px', borderRadius: '10px',
    background: type === 'error' ? '#ffe5e5' : type === 'success' ? '#e6ffea' : '#eef',
    border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 2px 10px rgba(0,0,0,.08)',
    maxWidth: '360px', fontFamily: 'system-ui, sans-serif', fontSize: '14px'
  });
  item.textContent = msg;
  box.appendChild(item);
  setTimeout(() => item.remove(), 4000);
}

function setLoading(el, isLoading) {
  if (!el) return;
  el.dataset.loading = isLoading ? '1' : '0';
  if (isLoading) {
    el.disabled = true;
    el._origText = el._origText || el.textContent;
    el.textContent = '…';
  } else {
    el.disabled = false;
    if (el._origText) el.textContent = el._origText;
  }
}

/* ===========================
   API Layer (via endpoint())
=========================== */
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API-Fehler ${res.status}: ${text || res.statusText}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// Auth
export async function login(credentials) {
  return fetchJson(endpoint('auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
}
export async function register(userData) {
  return fetchJson(endpoint('auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
}
export async function logout() {
  return fetchJson(endpoint('auth/logout'), { method: 'POST' });
}
export async function me() {
  return fetchJson(endpoint('auth/me'));
}

// Designs
export async function fetchDesigns() {
  return fetchJson(endpoint('designs'));
}
export async function fetchDesign(id) {
  return fetchJson(endpoint(`designs/${id}`));
}
export async function likeDesign(id) {
  return fetchJson(endpoint(`designs/${id}/like`), { method: 'POST' });
}
export async function dislikeDesign(id) {
  return fetchJson(endpoint(`designs/${id}/dislike`), { method: 'POST' });
}

// Uploads
export async function uploadFile(formData) {
  return fetchJson(endpoint('uploads'), { method: 'POST', body: formData });
}

// Appointments
export async function fetchAppointments() {
  return fetchJson(endpoint('appointments'));
}
export async function createAppointment(data) {
  return fetchJson(endpoint('appointments'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// Messages
export async function fetchMessages() {
  return fetchJson(endpoint('messages'));
}
export async function sendMessage(data) {
  return fetchJson(endpoint('messages'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/* ===========================
   Mini SPA Router
=========================== */
const routes = () => qsa('[data-route]').map(n => n.getAttribute('data-route'));

function showRoute(name) {
  qsa('[data-route]').forEach(el => {
    el.style.display = el.getAttribute('data-route') === name ? '' : 'none';
  });
  // optional: aktuellen Link markieren
  qsa('[data-link]').forEach(a => {
    const to = a.getAttribute('data-link');
    a.classList.toggle('active', to === name);
  });
  window.history.replaceState({}, '', `#/${encodeURIComponent(name)}`);
  document.dispatchEvent(new CustomEvent('route:changed', { detail: { route: name } }));
}

function getInitialRoute() {
  const hash = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
  const list = routes();
  if (hash && list.includes(hash)) return hash;
  return list[0] || 'home';
}

function bindRouterLinks() {
  qsa('[data-link]').forEach(a => {
    on(a, 'click', (e) => {
      e.preventDefault();
      const target = a.getAttribute('data-link');
      if (target) showRoute(target);
    });
  });
}

/* ===========================
   Render-Helpers
=========================== */
function renderDesignList(container, items = []) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="empty">Keine Designs gefunden.</div>`;
    return;
  }
  container.innerHTML = items.map(d => `
    <article class="design-card" data-design-id="${d.id}">
      <img src="${d.previewUrl || ''}" alt="${d.title || 'Design'}" />
      <div class="meta">
        <h3>${d.title || 'Ohne Titel'}</h3>
        <div class="actions">
          <button class="btn-like" data-action="like">👍 ${d.likes ?? 0}</button>
          <button class="btn-dislike" data-action="dislike">👎 ${d.dislikes ?? 0}</button>
          <a href="#" class="btn-open" data-action="open">Details</a>
        </div>
      </div>
    </article>
  `).join('');
}

function renderMessages(container, items = []) {
  if (!container) return;
  container.innerHTML = items.map(m => `
    <div class="message">
      <div class="from">${m.from || 'Unbekannt'}</div>
      <div class="body">${m.text || ''}</div>
      <div class="time">${new Date(m.createdAt || Date.now()).toLocaleString()}</div>
    </div>
  `).join('');
}

function renderAppointments(container, items = []) {
  if (!container) return;
  container.innerHTML = items.map(a => `
    <div class="appt">
      <div class="title">${a.title || 'Termin'}</div>
      <div class="time">${new Date(a.start).toLocaleString()} – ${new Date(a.end).toLocaleString()}</div>
      <div class="notes">${a.notes || ''}</div>
    </div>
  `).join('');
}

/* ===========================
   Bindings
=========================== */
async function initBindings() {
  // NAV
  bindRouterLinks();

  // LOGIN
  const loginForm = qs('#login-form');
  on(loginForm, 'submit', async (e) => {
    e.preventDefault();
    const submitBtn = qs('button[type="submit"]', loginForm);
    try {
      setLoading(submitBtn, true);
      const payload = Object.fromEntries(new FormData(loginForm).entries());
      await login(payload);
      toast('Erfolgreich eingeloggt', 'success');
      showRoute('dashboard');
      document.dispatchEvent(new Event('auth:changed'));
    } catch (err) {
      console.error(err);
      toast('Login fehlgeschlagen', 'error');
    } finally {
      setLoading(submitBtn, false);
    }
  });

  // REGISTER
  const registerForm = qs('#register-form');
  on(registerForm, 'submit', async (e) => {
    e.preventDefault();
    const btn = qs('button[type="submit"]', registerForm);
    try {
      setLoading(btn, true);
      const payload = Object.fromEntries(new FormData(registerForm).entries());
      await register(payload);
      toast('Registrierung erfolgreich', 'success');
      showRoute('dashboard');
      document.dispatchEvent(new Event('auth:changed'));
    } catch (err) {
      console.error(err);
      toast('Registrierung fehlgeschlagen', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  // LOGOUT (optional Button)
  const logoutBtn = qs('[data-action="logout"]');
  on(logoutBtn, 'click', async (e) => {
    e.preventDefault();
    try {
      await logout();
      toast('Abgemeldet', 'success');
      showRoute('login');
      document.dispatchEvent(new Event('auth:changed'));
    } catch (err) {
      console.error(err);
      toast('Abmelden fehlgeschlagen', 'error');
    }
  });

  // DESIGNS LIST
  async function loadDesigns() {
    const listEl = qs('#design-list');
    if (!listEl) return;
    try {
      const items = await fetchDesigns();
      renderDesignList(listEl, items);
    } catch (err) {
      console.error(err);
      toast('Designs konnten nicht geladen werden', 'error');
    }
  }
  on(document, 'route:changed', (e) => {
    if (e.detail.route === 'designs') loadDesigns();
  });
  // initial evtl. laden, falls Start-Route 'designs' ist:
  if ((location.hash || '').includes('designs')) loadDesigns();

  // DESIGN-Karten-Events (Delegation)
  const designList = qs('#design-list');
  on(designList, 'click', async (e) => {
    const card = e.target.closest('.design-card');
    if (!card) return;
    const id = card.getAttribute('data-design-id');
    if (!id) return;

    const action = e.target.getAttribute('data-action');
    if (action === 'like') {
      try { await likeDesign(id); toast('Gelikt', 'success'); await loadDesigns(); }
      catch (err) { console.error(err); toast('Like fehlgeschlagen', 'error'); }
    }
    if (action === 'dislike') {
      try { await dislikeDesign(id); toast('Dislike gesetzt', 'success'); await loadDesigns(); }
      catch (err) { console.error(err); toast('Dislike fehlgeschlagen', 'error'); }
    }
    if (action === 'open') {
      e.preventDefault();
      try {
        const data = await fetchDesign(id);
        // Beispiel: Details anzeigen
        const detail = qs('#design-detail');
        if (detail) {
          detail.innerHTML = `
            <img src="${data.previewUrl || ''}" alt="${data.title || ''}" />
            <h2>${data.title || ''}</h2>
            <p>${data.description || ''}</p>
          `;
          showRoute('design-detail');
        } else {
          toast('Detail-Ansicht nicht vorhanden', 'info');
        }
      } catch (err) {
        console.error(err);
        toast('Details konnten nicht geladen werden', 'error');
      }
    }
  });

  // UPLOAD
  const uploadForm = qs('#upload-form');
  on(uploadForm, 'submit', async (e) => {
    e.preventDefault();
    const btn = qs('button[type="submit"]', uploadForm);
    const fd = new FormData(uploadForm);
    try {
      setLoading(btn, true);
      await uploadFile(fd);
      uploadForm.reset();
      toast('Upload erfolgreich', 'success');
      document.dispatchEvent(new Event('uploads:changed'));
    } catch (err) {
      console.error(err);
      toast('Upload fehlgeschlagen', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  // APPOINTMENTS
  const appointmentForm = qs('#appointment-form');
  on(appointmentForm, 'submit', async (e) => {
    e.preventDefault();
    const btn = qs('button[type="submit"]', appointmentForm);
    const payload = Object.fromEntries(new FormData(appointmentForm).entries());
    try {
      setLoading(btn, true);
      await createAppointment(payload);
      appointmentForm.reset();
      toast('Termin erstellt', 'success');
      await loadAppointments();
    } catch (err) {
      console.error(err);
      toast('Termin konnte nicht erstellt werden', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  async function loadAppointments() {
    const listEl = qs('#appointment-list');
    if (!listEl) return;
    try {
      const items = await fetchAppointments();
      renderAppointments(listEl, items);
    } catch (err) {
      console.error(err);
      toast('Termine konnten nicht geladen werden', 'error');
    }
  }
  on(document, 'route:changed', (e) => {
    if (e.detail.route === 'appointments') loadAppointments();
  });

  // MESSAGES
  const messageForm = qs('#message-form');
  on(messageForm, 'submit', async (e) => {
    e.preventDefault();
    const btn = qs('button[type="submit"]', messageForm);
    const payload = Object.fromEntries(new FormData(messageForm).entries());
    try {
      setLoading(btn, true);
      await sendMessage(payload);
      messageForm.reset();
      toast('Nachricht gesendet', 'success');
      await loadMessages();
    } catch (err) {
      console.error(err);
      toast('Nachricht konnte nicht gesendet werden', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  async function loadMessages() {
    const listEl = qs('#message-list');
    if (!listEl) return;
    try {
      const items = await fetchMessages();
      renderMessages(listEl, items);
    } catch (err) {
      console.error(err);
      toast('Nachrichten konnten nicht geladen werden', 'error');
    }
  }
  on(document, 'route:changed', (e) => {
    if (e.detail.route === 'messages') loadMessages();
  });
}

/* ===========================
   Developer Menu (F2 / ?dev=1)
=========================== */
function createDevMenu() {
  if (qs('#dev-menu')) return;

  const routesList = routes();
  const bar = document.createElement('div');
  bar.id = 'dev-menu';
  bar.innerHTML = `
    <style>
      #dev-menu {
        position: fixed; left: 16px; bottom: 16px; z-index: 9998;
        display: none; gap: 8px; align-items: center;
        background: rgba(20,20,20,.85); color: #fff; padding: 10px 12px;
        border-radius: 12px; font: 14px/1.2 system-ui, sans-serif;
        box-shadow: 0 6px 20px rgba(0,0,0,.3); backdrop-filter: blur(4px);
      }
      #dev-menu .group { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      #dev-menu button, #dev-menu select {
        border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.08);
        color: #fff; padding: 6px 8px; border-radius: 10px; cursor: pointer;
      }
      #dev-menu button:hover { background: rgba(255,255,255,.15); }
      #dev-menu .pill { background: rgba(255,255,255,.12); padding: 4px 8px; border-radius: 999px; }
    </style>
    <div class="group">
      <span class="pill">DEV</span>
      <select id="dev-route">
        ${routesList.map(r => `<option value="${r}">${r}</option>`).join('')}
      </select>
      <button id="dev-go">Go</button>
      <button id="dev-login">Test-Login</button>
      <button id="dev-load-designs">Load Designs</button>
      <button id="dev-logout">Logout</button>
      <button id="dev-hide">Hide</button>
    </div>
  `;
  document.body.appendChild(bar);

  const show = () => bar.style.display = 'flex';
  const hide = () => bar.style.display = 'none';

  on(qs('#dev-go', bar), 'click', () => {
    const sel = qs('#dev-route', bar);
    if (sel?.value) showRoute(sel.value);
  });

  on(qs('#dev-login', bar), 'click', async () => {
    try {
      await login({ email: 'dev@example.com', password: 'devdev' });
      toast('Test-Login ok', 'success');
      document.dispatchEvent(new Event('auth:changed'));
    } catch (e) {
      toast('Test-Login fehlgeschlagen', 'error');
    }
  });

  on(qs('#dev-load-designs', bar), 'click', () => {
    showRoute('designs');
    document.dispatchEvent(new CustomEvent('route:changed', { detail: { route: 'designs' } }));
  });

  on(qs('#dev-logout', bar), 'click', async () => {
    try { await logout(); toast('Logout ok', 'success'); showRoute('login'); }
    catch { toast('Logout fehlgeschlagen', 'error'); }
  });

  on(qs('#dev-hide', bar), 'click', () => {
    localStorage.setItem('devMenu', '0');
    hide();
  });

  // Public controls
  window.__DEV_MENU__ = { show, hide };
}

function initDevMenu() {
  createDevMenu();
  const bar = qs('#dev-menu');
  const visible = localStorage.getItem('devMenu') === '1' || new URLSearchParams(location.search).has('dev');
  if (visible) bar.style.display = 'flex';

  on(window, 'keydown', (e) => {
    // F2 toggelt das Dev-Menü
    if (e.key === 'F2') {
      const shown = bar.style.display !== 'none';
      bar.style.display = shown ? 'none' : 'flex';
      localStorage.setItem('devMenu', shown ? '0' : '1');
    }
  });
}

/* ===========================
   Bootstrap
=========================== */
function bootstrap() {
  // Initial route anzeigen
  showRoute(getInitialRoute());

  // Router reagiert auf Hash-Änderungen (optional)
  on(window, 'hashchange', () => {
    const route = getInitialRoute();
    showRoute(route);
  });

  // Bindings + Dev-Menü
  initBindings();
  initDevMenu();

  // Debug
  // zeigt die effektive API-Basis in der Konsole (hilft bei Mixed-Content/CORS)
  // endpoint('') endet mit /api (oder deiner externen Basis ohne Slash am Ende)
  console.log('[TattooApp] API Base:', endpoint(''));
}

on(window, 'DOMContentLoaded', bootstrap);
