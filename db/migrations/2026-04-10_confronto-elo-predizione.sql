-- Notifica per la nuova funzionalità: confronto ELO nella predizione vittoria
INSERT INTO notifications (player_id, message)
SELECT id, 'Novità: nella sezione "Predizione Vittoria" puoi ora vedere il grafico di confronto ELO tra te e l''avversario selezionato!'
FROM players
WHERE deleted_at IS NULL;
