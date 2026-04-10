# Features

Cronologia delle funzionalità aggiunte al progetto.

---

## [2026-04-10] Modifica match da storico admin
L'admin può ora modificare categoria (11/21 pt) e partecipanti di qualsiasi match già registrato direttamente dallo Storico Partite nel dashboard. Il form si apre inline con un bottone "Modifica". Al salvataggio i punteggi ELO vengono ricalcolati. File coinvolti: `src/components/AdminDashboard.jsx`, `src/components/AdminDashboard.css`, `lib/controllers/matchController.js`, `lib/controllers/teamMatchController.js`, `lib/routes/matchRoutes.js`, `lib/routes/teamMatchRoutes.js`.

## [2026-04-10] Top 3 avversari consigliati in PlayerStats
Aggiunta sezione "Avversari Consigliati" nel profilo personale (solo per il proprio profilo), sopra a "Predizione Vittoria". Mostra i 3 avversari ottimali da sfidare, calcolati con la formula `expected_gain = winProb × K × (1 − winProb)` che bilancia probabilità di vittoria e punti guadagnabili. File coinvolti: `src/components/PlayerStats.jsx`, `src/components/PlayerStats.css`.

