const db = require('../db');

const recalculateScores = async () => {
  try {
    await db.query('BEGIN');
    
    // Reset all players to 1000
    await db.query("UPDATE players SET score_21 = 1000 WHERE role != 'admin'");
    
    // Get all verified matches in chronological order
    const matches = await db.query(
      "SELECT * FROM matches WHERE status = 'verified' ORDER BY created_at ASC"
    );

    for (const match of matches.rows) {
      const winnerId = match.creator_score > match.opponent_score ? match.creator_id : match.opponent_id;
      const loserId = match.creator_score > match.opponent_score ? match.opponent_id : match.creator_id;

      await db.query('UPDATE players SET score_21 = score_21 + 100 WHERE id = $1', [winnerId]);
      await db.query('UPDATE players SET score_21 = GREATEST(score_21 - 50, 0) WHERE id = $1', [loserId]);
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error recalculating scores:', err);
    throw err;
  }
};

exports.createMatch = async (req, res) => {
  const { opponent_id, creator_score, opponent_score } = req.body;
  const creator_id = req.user.id;

  if (creator_id === opponent_id) {
    return res.status(400).json({ error: "Non puoi giocare contro te stesso." });
  }

  if (creator_score < 0 || opponent_score < 0) {
    return res.status(400).json({ error: "I punteggi devono essere positivi." });
  }

  if (creator_score === opponent_score) {
    return res.status(400).json({ error: "Non sono ammessi pareggi." });
  }

  try {
    const winnerId = creator_score > opponent_score ? creator_id : opponent_id;
    
    await db.query(
      `INSERT INTO matches (creator_id, opponent_id, creator_score, opponent_score, status, winner_id, verified_at)
       VALUES ($1, $2, $3, $4, 'verified', $5, CURRENT_TIMESTAMP)`,
      [creator_id, opponent_id, creator_score, opponent_score, winnerId]
    );

    await recalculateScores();
    res.status(201).json({ message: "Match creato e punteggi aggiornati." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllMatches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const countResult = await db.query('SELECT COUNT(*) FROM matches');
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(`
      SELECT m.*, p1.name as creator_name, p2.name as opponent_name 
      FROM matches m
      JOIN players p1 ON m.creator_id = p1.id
      JOIN players p2 ON m.opponent_id = p2.id
      ORDER BY m.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      matches: result.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMatch = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM matches WHERE id = $1', [id]);
    await recalculateScores();
    res.json({ message: "Match eliminato e punteggi ricalcolati." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createMatchAdmin = async (req, res) => {
  const { creator_id, opponent_id, creator_score, opponent_score } = req.body;

  if (creator_id === opponent_id) {
    return res.status(400).json({ error: "I giocatori devono essere diversi." });
  }

  if (creator_score < 0 || opponent_score < 0) {
    return res.status(400).json({ error: "I punteggi devono essere positivi." });
  }

  if (creator_score === opponent_score) {
    return res.status(400).json({ error: "Non sono ammessi pareggi." });
  }

  try {
    const winnerId = creator_score > opponent_score ? creator_id : opponent_id;

    await db.query(
      `INSERT INTO matches (creator_id, opponent_id, creator_score, opponent_score, status, winner_id, verified_at)
       VALUES ($1, $2, $3, $4, 'verified', $5, CURRENT_TIMESTAMP)`,
      [creator_id, opponent_id, creator_score, opponent_score, winnerId]
    );

    await recalculateScores();
    res.status(201).json({ message: "Match admin creato e punteggi aggiornati." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
