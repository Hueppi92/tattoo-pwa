// Startseite: verzweigt nach Kunde/Artist und übernimmt ?studio
const params = new URLSearchParams(location.search);
const studio = params.get('studio');

document.getElementById('btn-client').addEventListener('click', () => {
  const qs = studio ? `?studio=${encodeURIComponent(studio)}` : '';
  location.href = `/index.html${qs}`;
});

document.getElementById('btn-artist').addEventListener('click', () => {
  const qs = studio ? `?studio=${encodeURIComponent(studio)}` : '';
  location.href = `/artist-login.html${qs}`;
});
