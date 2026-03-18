const db = require('../db');
const { computeExpected, computeExpectedDoubles, getK, getMultiplier, computeOverall } = require('./elo');

exports.getAllPlayers = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, company, bu, role, score_overall::float, score_1v1_21::float, score_1v1_11::float, score_2v2_21::float, score_2v2_11::float, games_1v1_21, games_1v1_11, games_2v2_21, games_2v2_11, last_delta_overall::float, last_delta_1v1_21::float, last_delta_1v1_11::float, last_delta_2v2_21::float, last_delta_2v2_11::float FROM players WHERE role != 'admin' AND deleted_at IS NULL AND approved = TRUE ORDER BY score_overall DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPlayerStats = async (req, res) => {
  const playerId = req.params.id;
  try {
    // Get player info
    const playerResult = await db.query(
      "SELECT id, name, company, bu, score_overall::float, score_1v1_21::float, score_1v1_11::float, score_2v2_21::float, score_2v2_11::float, games_1v1_21, games_1v1_11, games_2v2_21, games_2v2_11 FROM players WHERE id = $1 AND deleted_at IS NULL",
      [playerId]
    );
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Giocatore non trovato.' });
    }
    const player = playerResult.rows[0];

    // Get rank among active players (those with at least 1 game)
    const rankResult = await db.query(
      "SELECT id FROM players WHERE role != 'admin' AND deleted_at IS NULL AND (games_1v1_21 + games_1v1_11 + games_2v2_21 + games_2v2_11) > 0 ORDER BY score_overall DESC"
    );
    const totalPlayers = rankResult.rows.length;
    const overallRank = rankResult.rows.findIndex(r => r.id === playerId) + 1;

    // Get all players and all matches for ELO progression replay
    const allPlayersResult = await db.query("SELECT id, name FROM players WHERE role != 'admin' AND deleted_at IS NULL");
    const allPlayerIds = allPlayersResult.rows.map(p => p.id);
    const nameMap = {};
    for (const p of allPlayersResult.rows) nameMap[p.id] = p.name;

    const singlesResult = await db.query(
      "SELECT id, creator_id, opponent_id, creator_score, opponent_score, points_type, created_at FROM matches WHERE deleted_at IS NULL ORDER BY created_at ASC, id ASC"
    );
    const doublesResult = await db.query(
      "SELECT id, p1_id, p2_id, op1_id, op2_id, team_score, opponent_score, points_type, created_at FROM team_matches WHERE deleted_at IS NULL ORDER BY created_at ASC, id ASC"
    );

    // Initialize scores for replay
    const scores = {};
    const counts = {};
    for (const id of allPlayerIds) {
      scores[id] = { score_1v1_21: 1000, score_1v1_11: 1000, score_2v2_21: 1000, score_2v2_11: 1000 };
      counts[id] = 0;
    }

    // Merge all matches chronologically
    const allMatches = [
      ...singlesResult.rows.map(m => ({ ...m, match_type: 'singles' })),
      ...doublesResult.rows.map(m => ({ ...m, match_type: 'doubles' }))
    ].sort((a, b) => {
      const t = new Date(a.created_at) - new Date(b.created_at);
      return t !== 0 ? t : (a.id < b.id ? -1 : 1);
    });

    // Replay and track this player's ELO progression + win/loss
    const eloHistory = { overall: [], score_1v1_21: [], score_1v1_11: [], score_2v2_21: [], score_2v2_11: [] };
    const winLoss = { '1v1_21': { w: 0, l: 0 }, '1v1_11': { w: 0, l: 0 }, '2v2_21': { w: 0, l: 0 }, '2v2_11': { w: 0, l: 0 } };
    let streak = 0;
    let streakType = null; // 'W' or 'L'
    const h2h = {}; // opponent_id -> { w, l }
    let bestGain = null;  // { delta, opp, score, cat }
    let worstLoss = null; // { delta, opp, score, cat }
    let bestWin = null;   // { opp, score, cat, oppElo }
    let worstDefeat = null; // { opp, score, cat, oppElo }

    for (const match of allMatches) {
      const maxScore = match.points_type || 21;
      let involvedPlayer = false;

      if (match.match_type === 'singles') {
        const field = match.points_type === 11 ? 'score_1v1_11' : 'score_1v1_21';
        const cat = match.points_type === 11 ? '1v1_11' : '1v1_21';
        const cId = match.creator_id;
        const oId = match.opponent_id;
        if (!scores[cId] || !scores[oId]) continue;

        const cRating = scores[cId][field];
        const oRating = scores[oId][field];
        const cWon = match.creator_score > match.opponent_score;
        const scoreDiff = Math.abs(match.creator_score - match.opponent_score);
        const multiplier = getMultiplier(scoreDiff, maxScore);
        const cExpected = computeExpected(cRating, oRating);

        const cDelta = getK(counts[cId]) * ((cWon ? 1 : 0) - cExpected) * multiplier;
        const oDelta = getK(counts[oId]) * ((cWon ? 0 : 1) - (1 - cExpected)) * multiplier;

        scores[cId][field] = Math.max(scores[cId][field] + cDelta, 0);
        scores[oId][field] = Math.max(scores[oId][field] + oDelta, 0);
        counts[cId]++;
        counts[oId]++;

        if (cId === playerId || oId === playerId) {
          involvedPlayer = true;
          const won = (cId === playerId && cWon) || (oId === playerId && !cWon);
          const playerDelta = cId === playerId ? cDelta : oDelta;
          const oppId = cId === playerId ? oId : cId;
          const oppName = nameMap[oppId] || '?';
          const pScore = cId === playerId ? match.creator_score : match.opponent_score;
          const oScore = cId === playerId ? match.opponent_score : match.creator_score;
          const scoreStr = `${pScore}-${oScore}`;
          const oppElo = Math.round(cId === playerId ? oRating : cRating);

          // Track extremes
          if (won && (!bestGain || playerDelta > bestGain.delta)) bestGain = { delta: playerDelta, opp: oppName, score: scoreStr, cat };
          if (!won && (!worstLoss || playerDelta < worstLoss.delta)) worstLoss = { delta: playerDelta, opp: oppName, score: scoreStr, cat };
          if (won && (!bestWin || oppElo > bestWin.oppElo)) bestWin = { opp: oppName, score: scoreStr, cat, oppElo };
          if (!won && (!worstDefeat || oppElo < worstDefeat.oppElo)) worstDefeat = { opp: oppName, score: scoreStr, cat, oppElo };

          winLoss[cat][won ? 'w' : 'l']++;

          if (!h2h[oppId]) h2h[oppId] = { w: 0, l: 0 };
          h2h[oppId][won ? 'w' : 'l']++;;

          if (won) {
            streak = streakType === 'W' ? streak + 1 : 1;
            streakType = 'W';
          } else {
            streak = streakType === 'L' ? streak + 1 : 1;
            streakType = 'L';
          }
        }
      } else {
        const field = match.points_type === 11 ? 'score_2v2_11' : 'score_2v2_21';
        const cat = match.points_type === 11 ? '2v2_11' : '2v2_21';
        const p1 = match.p1_id, p2 = match.p2_id, op1 = match.op1_id, op2 = match.op2_id;
        if (!scores[p1] || !scores[p2] || !scores[op1] || !scores[op2]) continue;

        const team1Won = match.team_score > match.opponent_score;
        const scoreDiff = Math.abs(match.team_score - match.opponent_score);
        const multiplier = getMultiplier(scoreDiff, maxScore);

        const expectedTeam1 = computeExpectedDoubles(
          scores[p1][field], scores[p2][field], scores[op1][field], scores[op2][field]
        );

        for (const id of [p1, p2]) {
          const delta = getK(counts[id]) * ((team1Won ? 1 : 0) - expectedTeam1) * multiplier;
          scores[id][field] = Math.max(scores[id][field] + delta, 0);
          counts[id]++;
        }
        for (const id of [op1, op2]) {
          const delta = getK(counts[id]) * ((team1Won ? 0 : 1) - (1 - expectedTeam1)) * multiplier;
          scores[id][field] = Math.max(scores[id][field] + delta, 0);
          counts[id]++;
        }

        if ([p1, p2, op1, op2].includes(playerId)) {
          involvedPlayer = true;
          const inTeam1 = p1 === playerId || p2 === playerId;
          const won = (inTeam1 && team1Won) || (!inTeam1 && !team1Won);

          // Compute this player's delta
          const playerExpected = inTeam1 ? expectedTeam1 : (1 - expectedTeam1);
          const playerOutcome = won ? 1 : 0;
          const playerDelta = getK(counts[playerId] - 1) * (playerOutcome - playerExpected) * multiplier;
          const oppIds = inTeam1 ? [op1, op2] : [p1, p2];
          const oppNames = oppIds.map(id => nameMap[id] || '?').join(' & ');
          const pScore = inTeam1 ? match.team_score : match.opponent_score;
          const oScore = inTeam1 ? match.opponent_score : match.team_score;
          const scoreStr = `${pScore}-${oScore}`;
          const avgOppElo = Math.round(oppIds.reduce((s, id) => s + (scores[id]?.[field] || 1000), 0) / 2);

          if (won && (!bestGain || playerDelta > bestGain.delta)) bestGain = { delta: playerDelta, opp: oppNames, score: scoreStr, cat };
          if (!won && (!worstLoss || playerDelta < worstLoss.delta)) worstLoss = { delta: playerDelta, opp: oppNames, score: scoreStr, cat };
          if (won && (!bestWin || avgOppElo > bestWin.oppElo)) bestWin = { opp: oppNames, score: scoreStr, cat, oppElo: avgOppElo };
          if (!won && (!worstDefeat || avgOppElo < worstDefeat.oppElo)) worstDefeat = { opp: oppNames, score: scoreStr, cat, oppElo: avgOppElo };

          winLoss[cat][won ? 'w' : 'l']++;;

          if (won) {
            streak = streakType === 'W' ? streak + 1 : 1;
            streakType = 'W';
          } else {
            streak = streakType === 'L' ? streak + 1 : 1;
            streakType = 'L';
          }
        }
      }

      if (involvedPlayer) {
        const s = scores[playerId];
        const overall = Math.max(computeOverall(s), 0);

        // Build match info for tooltip
        let matchInfo = {};
        if (match.match_type === 'singles') {
          const oppId = match.creator_id === playerId ? match.opponent_id : match.creator_id;
          const pScore = match.creator_id === playerId ? match.creator_score : match.opponent_score;
          const oScore = match.creator_id === playerId ? match.opponent_score : match.creator_score;
          matchInfo = { opp: nameMap[oppId] || '?', score: `${pScore}-${oScore}` };
        } else {
          const inTeam1 = match.p1_id === playerId || match.p2_id === playerId;
          const oppIds = inTeam1 ? [match.op1_id, match.op2_id] : [match.p1_id, match.p2_id];
          const pScore = inTeam1 ? match.team_score : match.opponent_score;
          const oScore = inTeam1 ? match.opponent_score : match.team_score;
          matchInfo = { opp: oppIds.map(id => nameMap[id] || '?').join(' & '), score: `${pScore}-${oScore}` };
        }

        // Always push to overall
        eloHistory.overall.push({ elo: Math.round(overall), ...matchInfo });

        // Only push to the specific category of this match
        const catField = match.match_type === 'singles'
          ? (match.points_type === 11 ? 'score_1v1_11' : 'score_1v1_21')
          : (match.points_type === 11 ? 'score_2v2_11' : 'score_2v2_21');
        eloHistory[catField].push({ elo: Math.round(s[catField]), ...matchInfo });
      }
    }

    // Build h2h with names (reuse nameMap from above)
    const opponentIds = Object.keys(h2h);
    const h2hList = opponentIds.map(id => ({
      name: nameMap[id] || 'Sconosciuto',
      wins: h2h[id].w,
      losses: h2h[id].l,
      total: h2h[id].w + h2h[id].l
    })).sort((a, b) => b.total - a.total);

    res.json({
      player,
      rank: overallRank,
      totalPlayers,
      eloHistory,
      winLoss,
      streak: { count: streak, type: streakType },
      h2h: h2hList,
      extremes: {
        bestGain: bestGain ? { ...bestGain, delta: Math.round(bestGain.delta) } : null,
        worstLoss: worstLoss ? { ...worstLoss, delta: Math.round(worstLoss.delta) } : null,
        bestWin,
        worstDefeat
      }
    });
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
  const { name, company, bu, password } = req.body;

  if (!name && !company && !bu && !password) {
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
    if (company) {
      const nc = company.toUpperCase();
      await db.query('INSERT INTO companies (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [nc]);
      fields.push(`company = $${idx++}`);
      values.push(nc);
    }
    if (bu !== undefined) {
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
      `UPDATE players SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id, name, company, bu, role`,
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

exports.adminUpdatePlayer = async (req, res) => {
  const playerId = req.params.id;
  const { name, company, bu } = req.body;

  if (!name && !company && bu === undefined) {
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
    if (company) {
      const nc = company.toUpperCase();
      await db.query('INSERT INTO companies (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [nc]);
      fields.push(`company = $${idx++}`);
      values.push(nc);
    }
    if (bu !== undefined) {
      fields.push(`bu = $${idx++}`);
      values.push(bu);
    }

    values.push(playerId);

    const result = await db.query(
      `UPDATE players SET ${fields.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING id, name, company, bu, role`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Giocatore non trovato.' });
    }

    res.json({ player: result.rows[0], message: 'Giocatore aggiornato.' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Questo nome è già in uso.' });
    }
    res.status(500).json({ error: err.message });
  }
};

/* ---- Pending players: get unapproved ---- */
exports.getPendingPlayers = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, company, bu, created_at FROM players WHERE approved = FALSE AND deleted_at IS NULL AND role != 'admin' ORDER BY name ASC"
    );

    // Count matches per pending player
    const pending = [];
    for (const p of result.rows) {
      const sc = await db.query('SELECT COUNT(*) FROM matches WHERE (creator_id = $1 OR opponent_id = $1) AND deleted_at IS NULL', [p.id]);
      const dc = await db.query('SELECT COUNT(*) FROM team_matches WHERE (p1_id = $1 OR p2_id = $1 OR op1_id = $1 OR op2_id = $1) AND deleted_at IS NULL', [p.id]);
      pending.push({ ...p, match_count: parseInt(sc.rows[0].count) + parseInt(dc.rows[0].count) });
    }

    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.approvePlayer = async (req, res) => {
  const playerId = req.params.id;
  try {
    const result = await db.query(
      'UPDATE players SET approved = TRUE WHERE id = $1 AND deleted_at IS NULL RETURNING id, name',
      [playerId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Giocatore non trovato.' });
    }

    // Recalculate ELO since this player's matches are now "live"
    const { recalculateAll } = require('./elo');
    await recalculateAll();

    res.json({ message: `${result.rows[0].name} approvato.`, player: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---- Trash: get deleted items ---- */
exports.getDeletedItems = async (req, res) => {
  try {
    const players = await db.query(
      `SELECT p.id, p.name, p.company, p.bu, p.deleted_at, d.name as deleted_by_name
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

exports.permanentDeletePlayer = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT id, name FROM players WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Giocatore non trovato nel cestino.' });
    }
    await db.query('DELETE FROM players WHERE id = $1', [id]);
    res.json({ message: `Giocatore ${check.rows[0].name} eliminato definitivamente.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.permanentDeleteMatch = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM matches WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match non trovato nel cestino.' });
    }
    res.json({ message: 'Match eliminato definitivamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.permanentDeleteTeamMatch = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM team_matches WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match doppio non trovato nel cestino.' });
    }
    res.json({ message: 'Match doppio eliminato definitivamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
