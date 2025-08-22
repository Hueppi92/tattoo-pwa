import { API_BASE } from "./config.js";

async function fetchOverview() {
  try {
    const res = await fetch(`${API_BASE}/manager/overview`);
    const data = await res.json();

    document.getElementById("studio-summary").innerHTML = `
      <p>Künstler im Studio: <strong>${data.artists}</strong></p>
      <p>Registrierte Kunden: <strong>${data.customers}</strong></p>
      <p>Geplante Termine: <strong>${data.appointments}</strong></p>
    `;
  } catch (err) {
    console.error("Fehler beim Laden der Übersicht", err);
  }
}

async function fetchArtists() {
  try {
    const res = await fetch(`${API_BASE}/manager/artists`);
    const artists = await res.json();

    const list = document.getElementById("artist-list");
    list.innerHTML = "";
    artists.forEach(a => {
      const li = document.createElement("li");
      li.textContent = `${a.name} (${a.email})`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Fehler beim Laden der Künstler", err);
  }
}

async function fetchAppointments() {
  try {
    const res = await fetch(`${API_BASE}/manager/appointments`);
    const appointments = await res.json();

    const tbody = document.getElementById("appointment-list");
    tbody.innerHTML = "";
    appointments.forEach(appt => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(appt.date).toLocaleDateString()}</td>
        <td>${appt.time}</td>
        <td>${appt.customerName}</td>
        <td>${appt.artistName}</td>
        <td>${appt.status}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Fehler beim Laden der Termine", err);
  }
}

// Initial laden
document.addEventListener("DOMContentLoaded", () => {
  fetchOverview();
  fetchArtists();
  fetchAppointments();
});
