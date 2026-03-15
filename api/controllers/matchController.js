const db = require('../db');
const { recalculateAll } = require('../elo');

exports.createMatch = async (req, res) => {
  const { opponent_id, creator_score, opponent_score, points_type } = req.body;
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

    const matchPointsType = points_type === 11 ? 11 : 21;

    await db.query(
      `INSERT INTO matches (creator_id, opponent_id, creator_score, opponent_score, points_type, status, winner_id, verified_at)
       VALUES ($1, $2, $3, $4, $5, 'verified', $6, CURRENT_TIMESTAMP)`,
      [creator_id, opponent_id, creator_score, opponent_score, matchPointsType, winnerId]
    );

    await recalculateAll();
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
    await recalculateAll();
    res.json({ message: "Match eliminato e punteggi ricalcolati." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createMatchAdmin = async (req, res) => {
  const { creator_id, opponent_id, creator_score, opponent_score, points_type } = req.body;

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

    const matchPointsType = points_type === 11 ? 11 : 21;

    await db.query(
      `INSERT INTO matches (creator_id, opponent_id, creator_score, opponent_score, points_type, status, winner_id, verified_at)
       VALUES ($1, $2, $3, $4, $5, 'verified', $6, CURRENT_TIMESTAMP)`,
      [creator_id, opponent_id, creator_score, opponent_score, matchPointsType, winnerId]
    );

    await recalculateAll();
    res.status(201).json({ message: "Match admin creato e punteggi aggiornati." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUnifiedHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const matchType = req.query.match_type; // 'singles' or 'doubles'
    const pointsType = req.query.points_type ? parseInt(req.query.points_type) : null; // 11 or 21

    // Build the CTE parts based on filters
    const cteParts = [];
    const params = [];
    let paramIdx = 1;

    if (!matchType || matchType === 'singles') {
      const ptFilter = pointsType ? ` WHERE points_type = $${paramIdx++}` : '';
      if (pointsType) params.push(pointsType);
      cteParts.push(`
        SELECT id, created_at, points_type, 'singles' as match_type,
          creator_id as p1_id, NULL::uuid as p2_id,
          opponent_id as op1_id, NULL::uuid as op2_id,
          creator_score as t1_score, opponent_score as t2_score
        FROM matches${ptFilter}
      `);
    }

    if (!matchType || matchType === 'doubles') {
      const ptFilter = pointsType ? ` WHERE points_type = $${paramIdx++}` : '';
      if (pointsType) params.push(pointsType);
      cteParts.push(`
        SELECT id, created_at, points_type, 'doubles' as match_type,
          p1_id, p2_id, op1_id, op2_id,
          team_score as t1_score, opponent_score as t2_score
        FROM team_matches${ptFilter}
      `);
    }

    const cte = cteParts.join(' UNION ALL ');

    const countResult = await db.query(
      `SELECT COUNT(*) FROM (${cte}) as t`, params
    );
    const total = parseInt(countResult.rows[0].count);

    const limitParam = paramIdx++;
    const offsetParam = paramIdx++;
    const allParams = [...params, limit, offset];

    const result = await db.query(`
      WITH UnifiedHistory AS (${cte})
      SELECT uh.*,
        p1.name as p1_name, p2.name as p2_name,
        op1.name as op1_name, op2.name as op2_name
      FROM UnifiedHistory uh
      LEFT JOIN players p1 ON uh.p1_id = p1.id
      LEFT JOIN players p2 ON uh.p2_id = p2.id
      LEFT JOIN players op1 ON uh.op1_id = op1.id
      LEFT JOIN players op2 ON uh.op2_id = op2.id
      ORDER BY uh.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `, allParams);

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

exports.getPlayerHistory = async (req, res) => {
  try {
    const playerId = req.params.playerId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT SUM(cnt) as count FROM (
        SELECT COUNT(*) as cnt FROM matches WHERE creator_id = $1 OR opponent_id = $1
        UNION ALL
        SELECT COUNT(*) as cnt FROM team_matches WHERE p1_id = $1 OR p2_id = $1 OR op1_id = $1 OR op2_id = $1
      ) as t
    `;
    const countResult = await db.query(countQuery, [playerId]);
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(`
      WITH PlayerHistory AS (
        SELECT 
          id, 
          created_at, 
          points_type, 
          'singles' as match_type,
          creator_id as p1_id, 
          NULL::uuid as p2_id, 
          opponent_id as op1_id, 
          NULL::uuid as op2_id, 
          creator_score as t1_score, 
          opponent_score as t2_score
        FROM matches
        WHERE creator_id = $1 OR opponent_id = $1
        UNION ALL
        SELECT 
          id, 
          created_at, 
          points_type, 
          'doubles' as match_type,
          p1_id, 
          p2_id, 
          op1_id, 
          op2_id, 
          team_score as t1_score, 
          opponent_score as t2_score
        FROM team_matches
        WHERE p1_id = $1 OR p2_id = $1 OR op1_id = $1 OR op2_id = $1
      )
      SELECT 
        ph.*,
        p1.name as p1_name,
        p2.name as p2_name,
        op1.name as op1_name,
        op2.name as op2_name
      FROM PlayerHistory ph
      LEFT JOIN players p1 ON ph.p1_id = p1.id
      LEFT JOIN players p2 ON ph.p2_id = p2.id
      LEFT JOIN players op1 ON ph.op1_id = op1.id
      LEFT JOIN players op2 ON ph.op2_id = op2.id
      ORDER BY ph.created_at DESC
      LIMIT $2 OFFSET $3
    `, [playerId, limit, offset]);

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
