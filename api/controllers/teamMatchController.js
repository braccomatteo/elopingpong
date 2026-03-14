const db = require('../db');

const recalculateTeamScores = async () => {
  try {
    await db.query('BEGIN');

    // Reset all 2v2 scores to 1000 (score_overall is recalculated separately)
    await db.query("UPDATE players SET score_2v2_21 = 1000, score_2v2_11 = 1000 WHERE role != 'admin'");

    const matches = await db.query(
      'SELECT * FROM team_matches ORDER BY created_at ASC, id ASC'
    );

    for (const match of matches.rows) {
      const isTeam1Winner = match.team_score > match.opponent_score;
      const specificField = match.points_type === 11 ? 'score_2v2_11' : 'score_2v2_21';

      const t1p1 = match.p1_id;
      const t1p2 = match.p2_id;
      const t2p1 = match.op1_id;
      const t2p2 = match.op2_id;

      // Update specific 2v2 points type score for individuals
      if (isTeam1Winner) {
        await db.query(`UPDATE players SET ${specificField} = ${specificField} + 100 WHERE id IN ($1, $2)`, [t1p1, t1p2]);
        await db.query(`UPDATE players SET ${specificField} = GREATEST(${specificField} - 50, 0) WHERE id IN ($1, $2)`, [t2p1, t2p2]);
      } else {
        await db.query(`UPDATE players SET ${specificField} = ${specificField} + 100 WHERE id IN ($1, $2)`, [t2p1, t2p2]);
        await db.query(`UPDATE players SET ${specificField} = GREATEST(${specificField} - 50, 0) WHERE id IN ($1, $2)`, [t1p1, t1p2]);
      }
    }

    // Recalculate score_overall from all category scores
    await db.query(`
      UPDATE players SET score_overall = (
        (score_1v1_21 - 1000) + (score_1v1_11 - 1000) +
        (score_2v2_21 - 1000) + (score_2v2_11 - 1000)
      ) + 1000 WHERE role != 'admin'
    `);

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error recalculating team scores:', err);
    throw err;
  }
};

exports.createTeamMatch = async (req, res) => {
  const { p1_id, p2_id, op1_id, op2_id, team_score, opponent_score, points_type } = req.body;

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
    const matchPointsType = points_type === 11 ? 11 : 21;

    await db.query(
      `INSERT INTO team_matches (p1_id, p2_id, op1_id, op2_id, team_score, opponent_score, points_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [p1_id, p2_id, op1_id, op2_id, team_score, opponent_score, matchPointsType]
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
        p1.name as t1_p1_name, p2.name as t1_p2_name,
        op1.name as t2_p1_name, op2.name as t2_p2_name
      FROM team_matches tm
      JOIN players p1 ON tm.p1_id = p1.id
      JOIN players p2 ON tm.p2_id = p2.id
      JOIN players op1 ON tm.op1_id = op1.id
      JOIN players op2 ON tm.op2_id = op2.id
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
