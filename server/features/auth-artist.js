import { v4 as uuid } from 'uuid';

export default function register({ app, db }) {
  app.post('/api/artist/register', (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuid();
    try {
      db.prepare('INSERT INTO artists (id, name, email, password) VALUES (?, ?, ?, ?)')
        .run(id, name, email || null, password || null);
      res.json({ id, name, email });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/artist/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const row = db.prepare('SELECT id, name, email FROM artists WHERE email = ? AND (password = ? OR ? IS NULL)')
      .get(email, password || null, password || null);
    if (!row) return res.status(401).json({ error: 'invalid credentials' });
    res.json(row);
  });
}
