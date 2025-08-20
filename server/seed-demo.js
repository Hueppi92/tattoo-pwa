// server/seed-demo.js
// Seed-Daten für Demo: Manager, Artists, Customers

import db from './db.js';

function rowCount(table) {
  try {
    return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  } catch (e) {
    return 0;
  }
}

(function seedDemo(){
  const now = new Date().toISOString();

  // Artists ----------------------------------------------------------
  db.prepare(`CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  if (rowCount('artists') === 0) {
    db.prepare(`INSERT INTO artists(id,name,email,password,createdAt) VALUES (?,?,?,?,?)`)
      .run('artist-mia','Mia Ink','mia@demo.app','demo',now);
    db.prepare(`INSERT INTO artists(id,name,email,password,createdAt) VALUES (?,?,?,?,?)`)
      .run('artist-kaan','Kaan Black','kaan@demo.app','demo',now);
    console.log('[seed] artists ok');
  }

  // Customers --------------------------------------------------------
  db.prepare(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    artistId TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  if (rowCount('customers') === 0) {
    const ins = db.prepare(`INSERT INTO customers(id,name,email,password,artistId,createdAt) VALUES (?,?,?,?,?,?)`);
    ins.run('cust-lena','Lena','lena@demo.app','demo','artist-mia',now);
    ins.run('cust-jonas','Jonas','jonas@demo.app','demo','artist-mia',now);
    ins.run('cust-sara','Sara','sara@demo.app','demo','artist-mia',now);
    console.log('[seed] customers ok');
  }

  // Manager ----------------------------------------------------------
  db.prepare(`CREATE TABLE IF NOT EXISTS managers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  if (rowCount('managers') === 0) {
    db.prepare(`INSERT INTO managers(id,email,password,name,createdAt) VALUES (?,?,?,?,?)`)
      .run('mgr-admin','admin@demo.app','demo','Studio Admin', now);
    console.log('[seed] managers ok');
  }
})();
