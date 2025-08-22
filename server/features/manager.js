// server/features/manager.js
// Manager-API mit SQLite (better-sqlite3)
// Erwartet: db.js exportiert eine geöffnete DB-Instanz (db.prepare(...))

import express from "express";
import db from "../db.js";

const router = express.Router();

/* --------------------------------- Helpers -------------------------------- */
function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Optionales Rollen-Guard – nutze es, wenn du bereits Auth hast
function requireManager(req, res, next) {
  // Beispiel: req.user wird von vorherigem Auth-Middleware gesetzt
  if (req.user && req.user.role === "manager") return next();
  // solange keine Auth: einfach weiterlassen (oder einkommentieren)
  // return res.status(403).json({ error: "forbidden" });
  return next();
}

/* ------------------------------ /manager/overview ------------------------- */
/**
 * GET /api/manager/overview
 * Zählt Artists, Customers und Appointments.
 * Optional: Zeitraumfilter per ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get("/manager/overview", requireManager, (req, res) => {
  const { from, to } = req.query;
  let whereAppt = "WHERE 1=1";
  const params = {};

  if (from) { whereAppt += " AND a.date >= @from"; params.from = from; }
  if (to)   { whereAppt += " AND a.date <= @to";   params.to   = to;   }

  const artists = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='artist'").get().c;
  const customers = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='customer'").get().c;

  const appointments = db.prepare(`
    SELECT COUNT(*) AS c
    FROM appointments a
    ${whereAppt}
  `).get(params).c;

  res.json({ artists, customers, appointments });
});

/* ------------------------------ /manager/artists -------------------------- */
/**
 * GET /api/manager/artists
 * Liste der Artists, Suche & Pagination.
 * Query: q=search, limit, page
 */
router.get("/manager/artists", requireManager, (req, res) => {
  const q = (req.query.q || "").trim();
  const limit = Math.max(1, toInt(req.query.limit, 50));
  const page = Math.max(1, toInt(req.query.page, 1));
  const offset = (page - 1) * limit;

  let where = "WHERE role='artist'";
  const params = { limit, offset };

  if (q) {
    where += " AND (name LIKE @q OR email LIKE @q)";
    params.q = `%${q}%`;
  }

  const items = db.prepare(`
    SELECT id, name, email, created_at
    FROM users
    ${where}
    ORDER BY name COLLATE NOCASE ASC
    LIMIT @limit OFFSET @offset
  `).all(params);

  const total = db.prepare(`SELECT COUNT(*) AS c FROM users ${where}`).get(params).c;

  res.json({ items, page, limit, total });
});

/* --------------------------- /manager/appointments ------------------------ */
/**
 * GET /api/manager/appointments
 * Termine mit Artist/Customer-Join, Filter & Pagination.
 * Query: status, artistId, customerId, from, to, limit, page
 */
router.get("/manager/appointments", requireManager, (req, res) => {
  const { status, artistId, customerId, from, to } = req.query;
  const limit = Math.max(1, toInt(req.query.limit, 50));
  const page = Math.max(1, toInt(req.query.page, 1));
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params = { limit, offset };

  if (status)     { where += " AND a.status = @status";           params.status = status; }
  if (artistId)   { where += " AND a.artist_id = @artistId";      params.artistId = artistId; }
  if (customerId) { where += " AND a.customer_id = @customerId";  params.customerId = customerId; }
  if (from)       { where += " AND a.date >= @from";              params.from = from; }
  if (to)         { where += " AND a.date <= @to";                params.to   = to;   }

  const base = `
    FROM appointments a
    JOIN users cu ON cu.id = a.customer_id
    JOIN users ar ON ar.id = a.artist_id
    ${where}
  `;

  const items = db.prepare(`
    SELECT
      a.id, a.date, a.time, a.status,
      a.customer_id AS customerId, cu.name AS customerName, cu.email AS customerEmail,
      a.artist_id   AS artistId,   ar.name AS artistName,   ar.email AS artistEmail,
      a.note
    ${base}
    ORDER BY a.date ASC, a.time ASC
    LIMIT @limit OFFSET @offset
  `).all(params);

  const total = db.prepare(`SELECT COUNT(*) AS c ${base}`).get(params).c;

  res.json({ items, page, limit, total });
});

export default router;
