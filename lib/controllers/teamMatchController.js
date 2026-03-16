const db = require('../db');
const { recalculateAll } = require('./elo');

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

    await recalculateAll();
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

    const countResult = await db.query('SELECT COUNT(*) FROM team_matches WHERE deleted_at IS NULL');
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
      WHERE tm.deleted_at IS NULL
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
    await db.query('UPDATE team_matches SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1', [id, req.user.id]);
    await recalculateAll();
    res.json({ message: 'Match doppio eliminato e punteggi ricalcolati.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.restoreTeamMatch = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'UPDATE team_matches SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match doppio non trovato nel cestino.' });
    }
    await recalculateAll();
    res.json({ message: 'Match doppio ripristinato e punteggi ricalcolati.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
