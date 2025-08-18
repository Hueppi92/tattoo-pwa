# Tattoo PWA — Quickstart & Fixes

## Was wurde korrigiert?
- **Login-Probleme**: Seed-Skript erstellt (`server/seed-from-datajson.js`), das die Demodaten aus `server/data.json` in SQLite schreibt **und Passwörter hasht**. Ohne Seed war die DB leer, daher hat der Login nicht funktioniert.
- **Theme 404**: `client/artist-login.js` lädt das Theme nur noch mit gültiger Studio‑ID (kein Fallback auf `/studio/config`, das es serverseitig nicht gibt).
- **Default-Studio**: `client/config.js` setzt `DEFAULT_STUDIO = 'studioA'` (existiert in den Demo-Daten).

## Setup
1. **Server** (Node 18+ empfohlen)
   ```bash
   cd server
   npm i
   node seed-from-datajson.js   # Demodaten in db.sqlite schreiben
   npm start                    # startet auf http://localhost:3001
   ```

2. **Client**
   ```bash
   npx serve client             # oder ein anderer Static Server
   # Browser: http://localhost:3000/artist-login.html
   ```

3. **Logins testen**
   - Artist: `artistA` / `devpass`
   - Client: `clientA` / `devpass` (auf passendem Screen)
   - Manager (Studio A): POST `/api/studio/studioA/manager/login` mit `user=managerA`, `password=pass123`

## Hinweise
- `client/config.js` stellt `API_BASE` abhängig von `location` ein (lokal → `http://localhost:3001/api`).
- Wenn du ein anderes Studio als Default willst, ändere `window.DEFAULT_STUDIO` in `client/config.js` oder gib `?studio=studioA` in der URL mit.
