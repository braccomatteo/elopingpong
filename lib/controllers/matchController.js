const db = require('../db');
const { recalculateAll } = require('./elo');

exports.createMatch = async (req, res) => {
  const { opponent_id, creator_score, opponent_score, points_type, force } = req.body;
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
    // Duplicate check (same players, same score, same day) — skippable with force
    if (!force) {
      const matchPointsTypeCheck = points_type === 11 ? 11 : 21;
      const dup = await db.query(
        `SELECT id FROM matches
         WHERE deleted_at IS NULL
           AND points_type = $1
           AND DATE(created_at) = CURRENT_DATE
           AND (
             (creator_id = $2 AND opponent_id = $3 AND creator_score = $4 AND opponent_score = $5)
             OR
             (creator_id = $3 AND opponent_id = $2 AND creator_score = $5 AND opponent_score = $4)
           )`,
        [matchPointsTypeCheck, creator_id, opponent_id, creator_score, opponent_score]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ duplicate: true, error: 'Questo match sembra già esistere oggi. Vuoi registrarlo comunque?' });
      }
    }
    // Check if player is approved; if not, enforce 5-match limit
    const playerCheck = await db.query('SELECT approved FROM players WHERE id = $1', [creator_id]);
    if (playerCheck.rows.length > 0 && !playerCheck.rows[0].approved) {
      const sc = await db.query('SELECT COUNT(*) FROM matches WHERE (creator_id = $1 OR opponent_id = $1) AND deleted_at IS NULL', [creator_id]);
      const dc = await db.query('SELECT COUNT(*) FROM team_matches WHERE (p1_id = $1 OR p2_id = $1 OR op1_id = $1 OR op2_id = $1) AND deleted_at IS NULL', [creator_id]);
      if (parseInt(sc.rows[0].count) + parseInt(dc.rows[0].count) >= 5) {
        return res.status(403).json({ error: "Hai raggiunto il limite di 5 partite. Attendi l'approvazione di un admin per continuare." });
      }
    }

    const winnerId = creator_score > opponent_score ? creator_id : opponent_id;

    const matchPointsType = points_type === 11 ? 11 : 21;

    const matchRes = await db.query(
      `INSERT INTO matches (creator_id, opponent_id, creator_score, opponent_score, points_type, status, winner_id, verified_at)
       VALUES ($1, $2, $3, $4, $5, 'verified', $6, CURRENT_TIMESTAMP) RETURNING id`,
      [creator_id, opponent_id, creator_score, opponent_score, matchPointsType, winnerId]
    );
    const matchId = matchRes.rows[0].id;

    // Notify opponent
    const creatorRes = await db.query('SELECT name FROM players WHERE id = $1', [creator_id]);
    const creatorName = creatorRes.rows[0]?.name || 'Qualcuno';
    const notifMsg = `${creatorName} ha registrato una partita 1v1 contro di te: ${creator_score}-${opponent_score} (${matchPointsType} pts)`;
    await db.query('INSERT INTO notifications (player_id, match_id, message) VALUES ($1, $2, $3)', [opponent_id, matchId, notifMsg]);

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

    const countResult = await db.query('SELECT COUNT(*) FROM matches WHERE deleted_at IS NULL');
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(`
      SELECT m.*, p1.name as creator_name, p2.name as opponent_name 
      FROM matches m
      JOIN players p1 ON m.creator_id = p1.id
      JOIN players p2 ON m.opponent_id = p2.id
      WHERE m.deleted_at IS NULL
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
    await db.query('UPDATE matches SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1', [id, req.user.id]);
    await db.query('DELETE FROM notifications WHERE match_id = $1', [id]);
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

    const matchRes2 = await db.query(
      `INSERT INTO matches (creator_id, opponent_id, creator_score, opponent_score, points_type, status, winner_id, verified_at)
       VALUES ($1, $2, $3, $4, $5, 'verified', $6, CURRENT_TIMESTAMP) RETURNING id`,
      [creator_id, opponent_id, creator_score, opponent_score, matchPointsType, winnerId]
    );
    const matchId2 = matchRes2.rows[0].id;

    // Notify both players (admin registered)
    const notifMsgOpp = `Un admin ha registrato una partita 1v1: ${creator_score}-${opponent_score} (${matchPointsType} pts)`;
    const notifMsgCre = `Un admin ha registrato una partita 1v1: ${opponent_score}-${creator_score} (${matchPointsType} pts)`;
    await db.query('INSERT INTO notifications (player_id, match_id, message) VALUES ($1, $2, $3), ($4, $2, $5)', [opponent_id, matchId2, notifMsgOpp, creator_id, notifMsgCre]);

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
      const ptFilter = pointsType ? ` AND points_type = $${paramIdx++}` : '';
      if (pointsType) params.push(pointsType);
      cteParts.push(`
        SELECT id, created_at, points_type, 'singles' as match_type,
          creator_id as p1_id, NULL::uuid as p2_id,
          opponent_id as op1_id, NULL::uuid as op2_id,
          creator_score as t1_score, opponent_score as t2_score
        FROM matches WHERE deleted_at IS NULL${ptFilter}
      `);
    }

    if (!matchType || matchType === 'doubles') {
      const ptFilter = pointsType ? ` AND points_type = $${paramIdx++}` : '';
      if (pointsType) params.push(pointsType);
      cteParts.push(`
        SELECT id, created_at, points_type, 'doubles' as match_type,
          p1_id, p2_id, op1_id, op2_id,
          team_score as t1_score, opponent_score as t2_score
        FROM team_matches WHERE deleted_at IS NULL${ptFilter}
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
        SELECT COUNT(*) as cnt FROM matches WHERE (creator_id = $1 OR opponent_id = $1) AND deleted_at IS NULL
        UNION ALL
        SELECT COUNT(*) as cnt FROM team_matches WHERE (p1_id = $1 OR p2_id = $1 OR op1_id = $1 OR op2_id = $1) AND deleted_at IS NULL
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
        WHERE (creator_id = $1 OR opponent_id = $1) AND deleted_at IS NULL
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
        WHERE (p1_id = $1 OR p2_id = $1 OR op1_id = $1 OR op2_id = $1) AND deleted_at IS NULL
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

exports.updateMatch = async (req, res) => {
  const { id } = req.params;
  const { creator_id, opponent_id, creator_score, opponent_score, points_type } = req.body;

  if (!creator_id || !opponent_id || creator_score === undefined || opponent_score === undefined || !points_type) {
    return res.status(400).json({ error: 'Dati mancanti.' });
  }
  if (creator_id === opponent_id) {
    return res.status(400).json({ error: 'I giocatori devono essere diversi.' });
  }
  if (Number(creator_score) === Number(opponent_score)) {
    return res.status(400).json({ error: 'Non sono ammessi pareggi.' });
  }

  try {
    const winnerId = Number(creator_score) > Number(opponent_score) ? creator_id : opponent_id;
    const pt = Number(points_type) === 11 ? 11 : 21;
    const result = await db.query(
      `UPDATE matches SET creator_id=$1, opponent_id=$2, creator_score=$3, opponent_score=$4, points_type=$5, winner_id=$6
       WHERE id=$7 AND deleted_at IS NULL RETURNING id`,
      [creator_id, opponent_id, creator_score, opponent_score, pt, winnerId, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Match non trovato.' });
    await recalculateAll();
    res.json({ message: 'Match aggiornato e punteggi ricalcolati.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.restoreMatch = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'UPDATE matches SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match non trovato nel cestino.' });
    }
    await recalculateAll();
    res.json({ message: 'Match ripristinato e punteggi ricalcolati.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
