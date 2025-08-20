import { v4 as uuid } from 'uuid';
import path from 'path';
import { makeUploader } from '../utils/upload.js';

export default function register({ app, db, __dirname }) {
  const upload = makeUploader(path.join(__dirname, 'uploads'), 'templates');

  app.post('/api/customers/:customerId/templates', upload.single('image'), (req, res) => {
    const { customerId } = req.params;
    const { artistId, note } = req.body || {};
    const customer = db.prepare('SELECT id, artistId FROM customers WHERE id = ?').get(customerId);
    if (!customer) return res.status(404).json({ error: 'customer not found' });
    if (!artistId || customer.artistId !== artistId) return res.status(403).json({ error: 'customer not assigned to this artist' });

    const id = uuid();
    const imageUrl = req.file ? `/uploads/templates/${req.file.filename}` : null;
    db.prepare('INSERT INTO templates (id, customerId, artistId, note, imageUrl) VALUES (?, ?, ?, ?, ?)')
      .run(id, customerId, artistId, note || null, imageUrl);
    res.json({ id, customerId, artistId, note: note || null, imageUrl });
  });

  app.get('/api/customers/:customerId/templates', (req, res) => {
    const { customerId } = req.params;
    const rows = db.prepare('SELECT * FROM templates WHERE customerId = ? ORDER BY createdAt DESC').all(customerId);
    res.json(rows);
  });
}
