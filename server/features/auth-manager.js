// server/features/auth-manager.js
// Simpler Manager-Auth (Demo). E-Mail + Passwort im Klartext wie beim MVP-Seed.
// Produktionsbetrieb: Hashing + Sessions/JWT ergänzen.

export default function register({ app, db }) {
  // Tabelle sicherstellen
  db.prepare(`
    CREATE TABLE IF NOT EXISTS managers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Demo-Seed: einmalig einen Manager anlegen, wenn leer
  const row = db.prepare(`SELECT COUNT(*) AS n FROM managers`).get();
  if (row.n === 0) {
    db.prepare(`INSERT INTO managers (id, email, password, name) VALUES (?,?,?,?)`)
      .run('mgr-admin', 'admin@demo.app', 'demo', 'Studio Admin');
    console.log('[auth-manager] Seeded admin@demo.app / demo');
  }

  // Registrierung (optional)
  app.post('/api/manager/register', (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });
    try {
      const id = cryptoRandom();
      db.prepare(`INSERT INTO managers (id,email,password,name) VALUES (?,?,?,?)`)
        .run(id, email, password, name || null);
      res.json({ id, email, name: name || null });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Login
  app.post('/api/manager/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });
    const m = db.prepare(`SELECT id,email,name,password FROM managers WHERE email=?`).get(email);
    if (!m || m.password !== password) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    // Demo: kein echtes Token. Für später: JWT ausstellen.
    res.json({ ok: true, manager: { id: m.id, email: m.email, name: m.name } });
  });
}

function cryptoRandom() {
  return 'mgr-' + Math.random().toString(36).slice(2, 10);
}
