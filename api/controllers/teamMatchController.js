const db = require('../db');

// Helper: find or create a team for two players (order-independent)
const getOrCreateTeam = async (p1_id, p2_id) => {
  // Always store in sorted order so (A,B) === (B,A)
  const [first, second] = [p1_id, p2_id].sort();

  const existing = await db.query(
    'SELECT * FROM teams WHERE player1_id = $1 AND player2_id = $2',
    [first, second]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await db.query(
    'INSERT INTO teams (player1_id, player2_id, score_21) VALUES ($1, $2, 1000) RETURNING *',
    [first, second]
  );
  return result.rows[0];
};

const recalculateTeamScores = async () => {
  try {
    await db.query('BEGIN');
    await db.query('UPDATE teams SET score_21 = 1000');

    const matches = await db.query(
      'SELECT * FROM team_matches ORDER BY created_at ASC'
    );

    for (const match of matches.rows) {
      const winnerId = match.team_score > match.opponent_score ? match.team_id : match.opponent_team_id;
      const loserId = match.team_score > match.opponent_score ? match.opponent_team_id : match.team_id;

      await db.query('UPDATE teams SET score_21 = score_21 + 100 WHERE id = $1', [winnerId]);
      await db.query('UPDATE teams SET score_21 = GREATEST(score_21 - 50, 0) WHERE id = $1', [loserId]);
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error recalculating team scores:', err);
    throw err;
  }
};

exports.createTeamMatch = async (req, res) => {
  const { p1_id, p2_id, op1_id, op2_id, team_score, opponent_score } = req.body;

  const allIds = [p1_id, p2_id, op1_id, op2_id];
  const unique = new Set(allIds);
  if (unique.size !== 4) {
    return res.status(400).json({ error: 'Tutti i giocatori devono essere diversi.' });
  }

  if (team_score < 0 || opponent_score < 0) {
    return res.status(400).json({ error: 'I punteggi devono essere positivi.' });
  }

  if (team_score === opponent_score) {
    return res.status(400).json({ error: 'Non sono ammessi pareggi.' });
  }

  try {
    const team = await getOrCreateTeam(p1_id, p2_id);
    const opponentTeam = await getOrCreateTeam(op1_id, op2_id);

    const winnerId = team_score > opponent_score ? team.id : opponentTeam.id;

    await db.query(
      `INSERT INTO team_matches (team_id, opponent_team_id, team_score, opponent_score, winner_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [team.id, opponentTeam.id, team_score, opponent_score, winnerId]
    );

    await recalculateTeamScores();
    res.status(201).json({ message: 'Match doppio creato e punteggi aggiornati.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllTeamMatches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const countResult = await db.query('SELECT COUNT(*) FROM team_matches');
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(`
      SELECT tm.*,
        t1p1.name as t1_p1_name, t1p2.name as t1_p2_name,
        t2p1.name as t2_p1_name, t2p2.name as t2_p2_name
      FROM team_matches tm
      JOIN teams t1 ON tm.team_id = t1.id
      JOIN teams t2 ON tm.opponent_team_id = t2.id
      JOIN players t1p1 ON t1.player1_id = t1p1.id
      JOIN players t1p2 ON t1.player2_id = t1p2.id
      JOIN players t2p1 ON t2.player1_id = t2p1.id
      JOIN players t2p2 ON t2.player2_id = t2p2.id
      ORDER BY tm.created_at DESC
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

exports.deleteTeamMatch = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM team_matches WHERE id = $1', [id]);
    await recalculateTeamScores();
    res.json({ message: 'Match doppio eliminato e punteggi ricalcolati.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllTeams = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, p1.name as p1_name, p2.name as p2_name 
      FROM teams t
      JOIN players p1 ON t.player1_id = p1.id
      JOIN players p2 ON t.player2_id = p2.id
      ORDER BY t.score_21 DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
