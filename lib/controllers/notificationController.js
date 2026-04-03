const db = require('../db');

exports.getNotifications = async (req, res) => {
  const playerId = req.user.id;
  try {
    // Purge stale notifications (older than 30 days) on read
    await db.query(
      "DELETE FROM notifications WHERE player_id = $1 AND created_at < NOW() - INTERVAL '30 days'",
      [playerId]
    );
    const result = await db.query(
      'SELECT * FROM notifications WHERE player_id = $1 ORDER BY created_at DESC',
      [playerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.dismissNotification = async (req, res) => {
  const { id } = req.params;
  const playerId = req.user.id;
  try {
    await db.query(
      'DELETE FROM notifications WHERE id = $1 AND player_id = $2',
      [id, playerId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
