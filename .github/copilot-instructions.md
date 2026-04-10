# Copilot Instructions — Elopingpong

## Stack
- Frontend: React 18 + Vite
- Backend: Express (serverless, `/api/index.js`)
- Database: PostgreSQL (Neon) via `lib/db.js`
- Auth: JWT in localStorage, bcryptjs
- Hosting: Vercel — push su `main` → deploy automatico

## Aggiunta di nuove funzionalità

Ogni volta che viene aggiunta o modificata una funzionalità significativa al progetto, devi fare **entrambe** le seguenti cose:

### 1. Aggiorna FEATURES.md
Aggiungi in cima al file `FEATURES.md` (nella root del progetto) una voce con questo formato:

```
## [YYYY-MM-DD] Nome funzionalità
Breve descrizione di cosa fa e dove è stata implementata (file coinvolti).
```

### 2. Aggiungi una notifica per tutti i giocatori
Esegui questo passaggio, solo se la funzionalità non riguarda le pagine visibili solo all'admin.
Inserisci nella tabella `notifications` del database una riga per ogni giocatore attivo e non attivo (non eliminato). Usa questo pattern SQL:

```sql
INSERT INTO notifications (player_id, message)
SELECT id, 'Testo della notifica: descrizione della nuova funzionalità'
FROM players
WHERE deleted_at IS NULL;
```

Se la funzionalità richiede una migrazione o uno script da eseguire manualmente, inserisci questa query in un file `db/migrations/YYYY-MM-DD_nome-feature.sql`.

Se invece è possibile eseguirla programmaticamente (es. all'avvio o in un endpoint admin), indicalo chiaramente nel codice con un commento.
