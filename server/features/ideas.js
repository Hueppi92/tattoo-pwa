import { v4 as uuid } from 'uuid';
import path from 'path';
import { makeUploader } from '../utils/upload.js';

export default function register({ app, db, __dirname }) {
  const upload = makeUploader(path.join(__dirname, 'uploads'), 'ideas');

  app.post('/api/customers/:customerId/ideas', upload.single('image'), (req, res) => {
    const { customerId } = req.params;
    const { text } = req.body || {};
    const customer = db.prepare('SELECT id, artistId FROM customers WHERE id = ?').get(customerId);
    if (!customer || !customer.artistId) return res.status(400).json({ error: 'customer not found or not assigned to artist' });

    const id = uuid();
    const imageUrl = req.file ? `/uploads/ideas/${req.file.filename}` : null;
    db.prepare('INSERT INTO ideas (id, customerId, artistId, text, imageUrl) VALUES (?, ?, ?, ?, ?)')
      .run(id, customerId, customer.artistId, text || null, imageUrl);
    res.json({ id, customerId, artistId: customer.artistId, text: text || null, imageUrl });
  });

  app.get('/api/artist/:artistId/ideas', (req, res) => {
    const { artistId } = req.params;
    const rows = db.prepare('SELECT * FROM ideas WHERE artistId = ? ORDER BY createdAt DESC').all(artistId);
    res.json(rows);
  });

  app.get('/api/customers/:customerId/ideas', (req, res) => {
    const { customerId } = req.params;
    const rows = db.prepare('SELECT * FROM ideas WHERE customerId = ? ORDER BY createdAt DESC').all(customerId);
    res.json(rows);
  });
}
