// Startseite: verzweigt nach Kunde/Artist und übernimmt ?studio
const params = new URLSearchParams(location.search);
const studio = params.get('studio');
const isDev = params.has('dev');

function buildQuery() {
  const q = new URLSearchParams();
  if (studio) q.set('studio', studio);
  if (isDev) q.set('dev', '1');
  const s = q.toString();
  return s ? `?${s}` : '';
}

document.getElementById('btn-client').addEventListener('click', () => {
  location.href = `/index.html${buildQuery()}`;
});

document.getElementById('btn-artist').addEventListener('click', () => {
  location.href = `/artist-login.html${buildQuery()}`;
});
