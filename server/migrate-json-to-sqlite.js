// server/migrate-json-to-sqlite.js
// Script: vorhandene JSON-Dateien in SQLite migrieren

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadJson(filename) {
  const file = path.join(__dirname, "data", filename);
  if (!fs.existsSync(file)) {
    console.warn(`⚠️ Datei fehlt: ${filename}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function migrate() {
  console.log("🚀 Starte Migration…");

  const studios = loadJson("studios.json");
  const artists = loadJson("artists.json");
  const clients = loadJson("clients.json");
  const images = loadJson("images.json");

  const insertStudio = db.prepare(`
    INSERT OR IGNORE INTO studios (id, name, mgr_user, mgr_pass)
    VALUES (@id, @name, @mgr_user, @mgr_pass)
  `);

  const insertArtist = db.prepare(`
    INSERT OR IGNORE INTO artists (id, name, password, studio_id)
    VALUES (@id, @name, @password, @studio_id)
  `);

  const insertClient = db.prepare(`
    INSERT OR IGNORE INTO clients (id, name, password, studio_id, artist_id)
    VALUES (@id, @name, @password, @studio_id, @artist_id)
  `);

  const insertImage = db.prepare(`
    INSERT OR IGNORE INTO images (id, client_id, artist_id, kind, path, comment, created_at)
    VALUES (@id, @client_id, @artist_id, @kind, @path, @comment, @created_at)
  `);

  const tx = db.transaction(() => {
    for (const s of studios) insertStudio.run(s);
    for (const a of artists) insertArtist.run(a);
    for (const c of clients) insertClient.run(c);
    for (const i of images) insertImage.run(i);
  });

  tx();

  console.log("✅ Migration abgeschlossen!");
}

// nur ausführen, wenn direkt aufgerufen
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}
