#!/usr/bin/env node
/**
 * Migration runner — eseguito al build (vedi package.json "build").
 * Legge i file .sql da db/migrations/, registra quelli già eseguiti
 * nella tabella schema_migrations, ed esegue solo quelli nuovi.
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Use direct (non-pooler) connection for migrations — avoids Neon control plane issues
const connString = (process.env.POSTGRES_URL || '').replace('-pooler.', '.');
const pool = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function connectWithRetry(retries = 5, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (err) {
      console.log(`[migrate] Tentativo ${i}/${retries} fallito: ${err.message}`);
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function run() {
  const client = await connectWithRetry();
  try {
    // Crea tabella di tracking se non esiste
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[migrate] Nessuna cartella migrations trovata, skip.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // ordine alfabetico = cronologico grazie al prefisso YYYY-MM-DD

    const { rows: executed } = await client.query('SELECT filename FROM schema_migrations');
    const executedSet = new Set(executed.map(r => r.filename));

    let ran = 0;
    for (const file of files) {
      if (executedSet.has(file)) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`[migrate] Eseguo: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] ERRORE in ${file}:`, err.message);
        process.exit(1);
      }
    }

    if (ran === 0) {
      console.log('[migrate] Nessuna migration da eseguire.');
    } else {
      console.log(`[migrate] Eseguite ${ran} migration.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('[migrate] Errore fatale:', err.message);
  process.exit(1);
});
