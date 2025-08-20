export default function register({ app, db }) {
  app.post('/api/assign', (req, res) => {
    const { customerId, artistId } = req.body || {};
    if (!customerId || !artistId) return res.status(400).json({ error: 'customerId and artistId required' });
    const c = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    const a = db.prepare('SELECT id FROM artists WHERE id = ?').get(artistId);
    if (!c || !a) return res.status(404).json({ error: 'customer or artist not found' });
    db.prepare('UPDATE customers SET artistId = ? WHERE id = ?').run(artistId, customerId);
    res.json({ ok: true });
  });

  app.get('/api/artist/:artistId/customers', (req, res) => {
    const { artistId } = req.params;
    const rows = db.prepare('SELECT id, name, email FROM customers WHERE artistId = ?')
      .all(artistId);
    res.json(rows);
  });
}
