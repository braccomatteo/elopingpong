-- Notifica per la nuova funzionalità: Top 3 avversari consigliati
INSERT INTO notifications (player_id, message)
SELECT id, 'Novità: nel tuo profilo trovi ora i 3 avversari consigliati da sfidare, scelti in base alla probabilità di vittoria e ai punti che puoi guadagnare!'
FROM players
WHERE deleted_at IS NULL;
