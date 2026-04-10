INSERT INTO notifications (player_id, message)
SELECT id, 'Novità: nella sezione Head to Head puoi ora ordinare gli avversari per Più giocate, Win% o Recenti!'
FROM players
WHERE deleted_at IS NULL;
