INSERT INTO notifications (player_id, message)
SELECT id, 'Novità: nella classifica puoi ora filtrare i giocatori per azienda e BU!'
FROM players
WHERE deleted_at IS NULL;
