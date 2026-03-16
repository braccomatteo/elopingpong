const db = require('../db');

exports.getAllPlayers = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, bu, role, score_overall::float, score_1v1_21::float, score_1v1_11::float, score_2v2_21::float, score_2v2_11::float FROM players WHERE role != 'admin' AND deleted_at IS NULL ORDER BY score_overall DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePlayer = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT role FROM players WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Giocatore non trovato.' });
    }
    if (check.rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Non puoi eliminare un admin.' });
    }
    // Soft-delete the player and all their matches
    const adminId = req.user.id;
    await db.query('UPDATE players SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1', [id, adminId]);
    await db.query('UPDATE matches SET deleted_at = NOW(), deleted_by = $2 WHERE deleted_at IS NULL AND (creator_id = $1 OR opponent_id = $1)', [id, adminId]);
    await db.query('UPDATE team_matches SET deleted_at = NOW(), deleted_by = $2 WHERE deleted_at IS NULL AND (p1_id = $1 OR p2_id = $1 OR op1_id = $1 OR op2_id = $1)', [id, adminId]);
    const { recalculateAll } = require('./elo');
    await recalculateAll();
    res.json({ message: 'Giocatore eliminato (soft delete).' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, bu, password } = req.body;

  if (!name && !bu && !password) {
    return res.status(400).json({ error: 'Nessun dato da aggiornare.' });
  }

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }
    if (bu) {
      fields.push(`bu = $${idx++}`);
      values.push(bu);
    }
    if (password) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      fields.push(`password = $${idx++}`);
      values.push(hashedPassword);
    }

    values.push(userId);

    const result = await db.query(
      `UPDATE players SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id, name, bu, role`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato.' });
    }

    res.json({ user: result.rows[0], message: 'Profilo aggiornato.' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Questo nome è già in uso.' });
    }
    res.status(500).json({ error: err.message });
  }
};

/* ---- Trash: get deleted items ---- */
exports.getDeletedItems = async (req, res) => {
  try {
    const players = await db.query(
      `SELECT p.id, p.name, p.bu, p.deleted_at, d.name as deleted_by_name
       FROM players p LEFT JOIN players d ON p.deleted_by = d.id
       WHERE p.deleted_at IS NOT NULL AND p.role != 'admin'
       ORDER BY p.deleted_at DESC`
    );
    const matches = await db.query(
      `SELECT m.id, m.created_at, m.deleted_at, m.points_type,
              p1.name as creator_name, p2.name as opponent_name,
              m.creator_score, m.opponent_score,
              d.name as deleted_by_name
       FROM matches m
       LEFT JOIN players p1 ON m.creator_id = p1.id
       LEFT JOIN players p2 ON m.opponent_id = p2.id
       LEFT JOIN players d ON m.deleted_by = d.id
       WHERE m.deleted_at IS NOT NULL
       ORDER BY m.deleted_at DESC`
    );
    const teamMatches = await db.query(
      `SELECT tm.id, tm.created_at, tm.deleted_at, tm.points_type,
              tm.team_score, tm.opponent_score,
              p1.name as p1_name, p2.name as p2_name,
              op1.name as op1_name, op2.name as op2_name,
              d.name as deleted_by_name
       FROM team_matches tm
       LEFT JOIN players p1 ON tm.p1_id = p1.id
       LEFT JOIN players p2 ON tm.p2_id = p2.id
       LEFT JOIN players op1 ON tm.op1_id = op1.id
       LEFT JOIN players op2 ON tm.op2_id = op2.id
       LEFT JOIN players d ON tm.deleted_by = d.id
       WHERE tm.deleted_at IS NOT NULL
       ORDER BY tm.deleted_at DESC`
    );
    res.json({
      players: players.rows,
      matches: matches.rows,
      teamMatches: teamMatches.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.restorePlayer = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT id, name, deleted_at FROM players WHERE id = $1 AND deleted_at IS NOT NULL',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Giocatore non trovato nel cestino.' });
    }
    const playerDeletedAt = result.rows[0].deleted_at;
    await db.query('UPDATE players SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', [id]);
    // Only restore matches that were deleted at the same time as the player (cascade), not individually deleted before
    await db.query('UPDATE matches SET deleted_at = NULL, deleted_by = NULL WHERE (creator_id = $1 OR opponent_id = $1) AND deleted_at >= $2', [id, playerDeletedAt]);
    await db.query('UPDATE team_matches SET deleted_at = NULL, deleted_by = NULL WHERE (p1_id = $1 OR p2_id = $1 OR op1_id = $1 OR op2_id = $1) AND deleted_at >= $2', [id, playerDeletedAt]);
    const { recalculateAll } = require('./elo');
    await recalculateAll();
    res.json({ message: `Giocatore ${result.rows[0].name} ripristinato con tutti i match.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
