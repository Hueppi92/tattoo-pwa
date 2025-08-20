import { v4 as uuid } from 'uuid';
import path from 'path';
import { makeUploader } from '../utils/upload.js';

export default function register({ app, db, __dirname }) {
  const upload = makeUploader(path.join(__dirname, 'uploads'), 'wannados');

  app.post('/api/artist/:artistId/wannados', upload.single('image'), (req, res) => {
    const { artistId } = req.params;
    const { title } = req.body || {};
    const artist = db.prepare('SELECT id FROM artists WHERE id = ?').get(artistId);
    if (!artist) return res.status(404).json({ error: 'artist not found' });

    const id = uuid();
    const imageUrl = req.file ? `/uploads/wannados/${req.file.filename}` : null;
    db.prepare('INSERT INTO wannados (id, artistId, title, imageUrl) VALUES (?, ?, ?, ?)')
      .run(id, artistId, title || null, imageUrl);
    res.json({ id, artistId, title: title || null, imageUrl });
  });

  app.get('/api/customers/:customerId/wannados', (req, res) => {
    const { customerId } = req.params;
    const customer = db.prepare('SELECT artistId FROM customers WHERE id = ?').get(customerId);
    if (!customer || !customer.artistId) return res.status(400).json({ error: 'customer not found or not assigned to artist' });
    const rows = db.prepare('SELECT * FROM wannados WHERE artistId = ? ORDER BY createdAt DESC').all(customer.artistId);
    res.json(rows);
  });
}
