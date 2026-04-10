INSERT INTO notifications (player_id, message)
SELECT id, 'Novità: nel tuo storico partite puoi ora filtrare per nome avversario, azienda e BU!'
FROM players
WHERE deleted_at IS NULL;
