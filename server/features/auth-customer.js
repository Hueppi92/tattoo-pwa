import { v4 as uuid } from 'uuid';

export default function register({ app, db }) {
  app.post('/api/customer/register', (req, res) => {
    const { name, email, password, artistId } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = uuid();
    try {
      db.prepare('INSERT INTO customers (id, name, email, password, artistId) VALUES (?, ?, ?, ?, ?)')
        .run(id, name, email || null, password || null, artistId || null);
      res.json({ id, name, email, artistId: artistId || null });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/customer/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const row = db.prepare('SELECT id, name, email, artistId FROM customers WHERE email = ? AND (password = ? OR ? IS NULL)')
      .get(email, password || null, password || null);
    if (!row) return res.status(401).json({ error: 'invalid credentials' });
    res.json(row);
  });
}
