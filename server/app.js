// server/app.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// --- Pfade korrekt auflösen (ESM) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import managerRoutes from "./features/manager.js";           // <-- RELATIVER Import!
import db from "./db.js";                                    // DB wird initialisiert
// Optional weitere Routen:
// import authArtist from "./features/auth-artist.js";
// import authCustomer from "./features/auth-customer.js";
// import authManager from "./features/auth-manager.js";
// import wannados from "./features/wannados.js";
// import ideas from "./features/ideas.js";
// import templates from "./features/templates.js";

const app = express();
const PORT = process.env.PORT || 8080;

// --- Middlewares ---
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Static: Client & Uploads ausliefern (falls benötigt)
app.use("/", express.static(path.join(__dirname, "..", "client")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health
app.get("/api/health", (req, res) => {
  try {
    // kleine DB‑Probe
    db.prepare("SELECT 1").get();
    res.json({ ok: true, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});
// Altes studio.html => dauerhaft auf Manager-Portal
app.get(['/studio.html','/client/studio.html'], (req, res) => {
  res.redirect(301, '/client/manager.html');
});

// --- API-Routen mounten ---
app.use("/api", managerRoutes);
 app.use("/api", authArtist);
 app.use("/api", authCustomer);
 app.use("/api", authManager);
 app.use("/api", wannados);
 app.use("/api", ideas);
 app.use("/api", templates);

// SPA-Fallback (optional, wenn du client‑Routing brauchst):
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "..", "client", "index.html"));
// });

app.listen(PORT, () => {
  console.log(`[server] running on :${PORT}`);
});
