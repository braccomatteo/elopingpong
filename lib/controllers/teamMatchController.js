const db = require('../db');
const { recalculateAll } = require('./elo');

exports.createTeamMatch = async (req, res) => {
  const { p1_id, p2_id, op1_id, op2_id, team_score, opponent_score, points_type, force } = req.body;

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
    // Duplicate check — same 4 players (any order within teams), same score, same day
    if (!force) {
      const matchPointsTypeCheck = points_type === 11 ? 11 : 21;
      const dup = await db.query(
        `SELECT id FROM team_matches
         WHERE deleted_at IS NULL
           AND points_type = $1
           AND DATE(created_at) = CURRENT_DATE
           AND team_score = $2 AND opponent_score = $3
           AND (
             (p1_id = ANY($4) AND p2_id = ANY($4) AND op1_id = ANY($5) AND op2_id = ANY($5))
             OR
             (p1_id = ANY($5) AND p2_id = ANY($5) AND op1_id = ANY($4) AND op2_id = ANY($4))
           )`,
        [matchPointsTypeCheck, team_score, opponent_score, [p1_id, p2_id], [op1_id, op2_id]]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ duplicate: true, error: 'Questo match sembra già esistere oggi. Vuoi registrarlo comunque?' });
      }
    }
    // Check if creating player is approved; if not, enforce 5-match limit
    const creatorId = req.user?.id || p1_id;
    const playerCheck = await db.query('SELECT approved FROM players WHERE id = $1', [creatorId]);
    if (playerCheck.rows.length > 0 && !playerCheck.rows[0].approved) {
      const sc = await db.query('SELECT COUNT(*) FROM matches WHERE (creator_id = $1 OR opponent_id = $1) AND deleted_at IS NULL', [creatorId]);
      const dc = await db.query('SELECT COUNT(*) FROM team_matches WHERE (p1_id = $1 OR p2_id = $1 OR op1_id = $1 OR op2_id = $1) AND deleted_at IS NULL', [creatorId]);
      if (parseInt(sc.rows[0].count) + parseInt(dc.rows[0].count) >= 5) {
        return res.status(403).json({ error: "Hai raggiunto il limite di 5 partite. Attendi l'approvazione di un admin per continuare." });
      }
    }

    const matchPointsType = points_type === 11 ? 11 : 21;

    const tmRes = await db.query(
      `INSERT INTO team_matches (p1_id, p2_id, op1_id, op2_id, team_score, opponent_score, points_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [p1_id, p2_id, op1_id, op2_id, team_score, opponent_score, matchPointsType]
    );
    const tmId = tmRes.rows[0].id;

    // Notify all players except p1 (the creator)
    const allIds = [p1_id, p2_id, op1_id, op2_id];
    const namesRes = await db.query('SELECT id, name FROM players WHERE id = ANY($1)', [allIds]);
    const nameMap = {};
    namesRes.rows.forEach(r => { nameMap[r.id] = r.name; });
    const p1Name = nameMap[p1_id] || 'Qualcuno';
    const notifs = [
      { id: p2_id, msg: `${p1Name} ha registrato una partita 2v2 con te: ${team_score}-${opponent_score} (${matchPointsType} pts)` },
      { id: op1_id, msg: `${p1Name} ha registrato una partita 2v2 contro di te: ${team_score}-${opponent_score} (${matchPointsType} pts)` },
      { id: op2_id, msg: `${p1Name} ha registrato una partita 2v2 contro di te: ${team_score}-${opponent_score} (${matchPointsType} pts)` },
    ];
    for (const n of notifs) {
      await db.query('INSERT INTO notifications (player_id, match_id, message) VALUES ($1, $2, $3)', [n.id, tmId, n.msg]);
    }

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
    await db.query('DELETE FROM notifications WHERE match_id = $1', [id]);
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
