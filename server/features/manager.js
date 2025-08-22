import express from "express";
const router = express.Router();

// Dummy-Daten – später DB-Abfragen einsetzen
router.get("/manager/overview", (req, res) => {
  res.json({ artists: 3, customers: 12, appointments: 24 });
});

router.get("/manager/artists", (req, res) => {
  res.json([
    { name: "Max Mustermann", email: "max@studio.de" },
    { name: "Lisa Beispiel", email: "lisa@studio.de" }
  ]);
});

router.get("/manager/appointments", (req, res) => {
  res.json([
    { date: "2025-09-01", time: "10:00", customerName: "Anna K.", artistName: "Max Mustermann", status: "bestätigt" },
    { date: "2025-09-02", time: "14:00", customerName: "Tom B.", artistName: "Lisa Beispiel", status: "offen" }
  ]);
});

export default router;
