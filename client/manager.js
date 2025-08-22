// client/manager.js
// Manager-Portal: lädt Übersicht, Künstlerliste, Terminliste
// Erwartet: config.js exportiert API_BASE

import { API_BASE } from "./config.js";

function qs(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`Element #${id} nicht gefunden`);
  return el;
}

function toDateStr(d) {
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

async function fetchJSON(url) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function renderOverview() {
  const container = qs("studio-summary");
  if (!container) return;
  container.innerHTML = `<p>lade …</p>`;
  try {
    const params = new URLSearchParams();
    // optional: Zeitraumfilter aus Inputs übernehmen
    const fromEl = qs("filter-from");
    const toEl = qs("filter-to");
    if (fromEl?.value) params.set("from", fromEl.value);
    if (toEl?.value) params.set("to", toEl.value);

    const data = await fetchJSON(`${API_BASE}/manager/overview?${params.toString()}`);
    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi"><span>Künstler</span><strong>${data.artists}</strong></div>
        <div class="kpi"><span>Kunden</span><strong>${data.customers}</strong></div>
        <div class="kpi"><span>Termine</span><strong>${data.appointments}</strong></div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="error">Übersicht konnte nicht geladen werden.</p>`;
  }
}

async function renderArtists(page = 1) {
  const listWrap = qs("artist-list");
  if (!listWrap) return;
  const search = (qs("artist-search")?.value || "").trim();
  const limit = 25;
  const params = new URLSearchParams({ page, limit });
  if (search) params.set("q", search);

  listWrap.innerHTML = `<li>lade …</li>`;
  try {
    const { items, total } = await fetchJSON(`${API_BASE}/manager/artists?${params.toString()}`);
    if (!items?.length) {
      listWrap.innerHTML = `<li>Keine Künstler gefunden</li>`;
      return;
    }
    listWrap.innerHTML = "";
    items.forEach(a => {
      const li = document.createElement("li");
      li.className = "row";
      li.innerHTML = `
        <div class="title">${a.name || "(ohne Namen)"}</div>
        <div class="sub">${a.email || ""}</div>
        <div class="meta">seit ${toDateStr(a.created_at)}</div>
      `;
      listWrap.appendChild(li);
    });

    const totalEl = qs("artist-total");
    if (totalEl) totalEl.textContent = String(total);
  } catch (err) {
    console.error(err);
    listWrap.innerHTML = `<li class="error">Künstler konnten nicht geladen werden.</li>`;
  }
}

async function renderAppointments(page = 1) {
  const body = qs("appointment-list");
  if (!body) return;

  const limit = 50;
  const params = new URLSearchParams({ page, limit });

  const status = qs("filter-status")?.value;
  const artistId = qs("filter-artist")?.value;
  const customerId = qs("filter-customer")?.value;
  const from = qs("filter-from")?.value;
  const to = qs("filter-to")?.value;

  if (status) params.set("status", status);
  if (artistId) params.set("artistId", artistId);
  if (customerId) params.set("customerId", customerId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  body.innerHTML = `<tr><td colspan="5">lade …</td></tr>`;
  try {
    const { items, total } = await fetchJSON(`${API_BASE}/manager/appointments?${params.toString()}`);
    if (!items?.length) {
      body.innerHTML = `<tr><td colspan="5">Keine Termine gefunden</td></tr>`;
      return;
    }
    body.innerHTML = "";
    items.forEach(appt => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${toDateStr(appt.date)}</td>
        <td>${appt.time}</td>
        <td>${appt.customerName}</td>
        <td>${appt.artistName}</td>
        <td><span class="badge status-${appt.status}">${appt.status}</span></td>
      `;
      body.appendChild(tr);
    });
    const totalEl = qs("appointment-total");
    if (totalEl) totalEl.textContent = String(total);
  } catch (err) {
    console.error(err);
    body.innerHTML = `<tr><td colspan="5" class="error">Termine konnten nicht geladen werden.</td></tr>`;
  }
}

function wireEvents() {
  qs("btn-refresh")?.addEventListener("click", () => {
    renderOverview();
    renderArtists(1);
    renderAppointments(1);
  });

  qs("artist-search")?.addEventListener("input", debounce(() => renderArtists(1), 300));

  ["filter-status","filter-artist","filter-customer","filter-from","filter-to"]
    .forEach(id => qs(id)?.addEventListener("change", () => renderAppointments(1)));
}

function debounce(fn, t = 300) {
  let h; return (...args) => { clearTimeout(h); h = setTimeout(() => fn(...args), t); };
}

document.addEventListener("DOMContentLoaded", () => {
  wireEvents();
  renderOverview();
  renderArtists();
  renderAppointments();
});
