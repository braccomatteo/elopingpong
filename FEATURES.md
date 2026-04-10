# Features

Cronologia delle funzionalità aggiunte al progetto.

---

## [2026-04-10] Top 3 avversari consigliati in PlayerStats
Aggiunta sezione "Avversari Consigliati" nel profilo personale (solo per il proprio profilo), sopra a "Predizione Vittoria". Mostra i 3 avversari ottimali da sfidare, calcolati con la formula `expected_gain = winProb × K × (1 − winProb)` che bilancia probabilità di vittoria e punti guadagnabili. File coinvolti: `src/components/PlayerStats.jsx`, `src/components/PlayerStats.css`.

