# Features

Cronologia delle funzionalità aggiunte al progetto.

---

## [2026-04-10] Filtri storico partite
Nello storico delle partite personale è ora possibile filtrare per nome avversario, azienda e BU. I filtri vengono inviati al backend che applica le condizioni SQL dinamicamente con paginazione corretta. File coinvolti: `lib/controllers/matchController.js`, `src/components/PlayerStats.jsx`, `src/components/PlayerStats.css`.

## [2026-04-10] Ordinamento Head to Head
Aggiunta la possibilità di ordinare le card Head to Head in tre modalità: "Più giocate" (default), "Win%" e "Recenti" (per data ultima partita). Il backend ora traccia `lastPlayed` per ogni avversario. File coinvolti: `lib/controllers/playerController.js`, `src/components/PlayerStats.jsx`, `src/components/PlayerStats.css`.

## [2026-04-10] Confronto ELO nella Predizione Vittoria
Selezionando un avversario in "Predizione Vittoria", appare ora un line graph che mostra l'andamento ELO overall di entrambi i giocatori sovrapposti sullo stesso grafico. L'asse X mostra il progresso percentuale di carriera (nascondendo il numero esatto di partite). File coinvolti: `src/components/PlayerStats.jsx`, `src/components/PlayerStats.css`.

## [2026-04-10] Modifica match da storico admin
L'admin può ora modificare categoria (11/21 pt) e partecipanti di qualsiasi match già registrato direttamente dallo Storico Partite nel dashboard. Il form si apre inline con un bottone "Modifica". Al salvataggio i punteggi ELO vengono ricalcolati. File coinvolti: `src/components/AdminDashboard.jsx`, `src/components/AdminDashboard.css`, `lib/controllers/matchController.js`, `lib/controllers/teamMatchController.js`, `lib/routes/matchRoutes.js`, `lib/routes/teamMatchRoutes.js`.

## [2026-04-10] Top 3 avversari consigliati in PlayerStats
Aggiunta sezione "Avversari Consigliati" nel profilo personale (solo per il proprio profilo), sopra a "Predizione Vittoria". Mostra i 3 avversari ottimali da sfidare, calcolati con la formula `expected_gain = winProb × K × (1 − winProb)` che bilancia probabilità di vittoria e punti guadagnabili. File coinvolti: `src/components/PlayerStats.jsx`, `src/components/PlayerStats.css`.

