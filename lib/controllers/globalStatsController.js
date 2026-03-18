const db = require('../db');

exports.getGlobalStats = async (req, res) => {
  try {
    // Total match counts
    const singlesCount = await db.query('SELECT COUNT(*) FROM matches WHERE deleted_at IS NULL');
    const doublesCount = await db.query('SELECT COUNT(*) FROM team_matches WHERE deleted_at IS NULL');
    const totalSingles = parseInt(singlesCount.rows[0].count);
    const totalDoubles = parseInt(doublesCount.rows[0].count);

    // Active players
    const activePlayers = await db.query(
      "SELECT id, name, score_overall, games_1v1_21, games_1v1_11, games_2v2_21, games_2v2_11 FROM players WHERE deleted_at IS NULL AND approved = TRUE AND role != 'admin'"
    );

    // Highest overall ELO
    let highestElo = null;
    for (const p of activePlayers.rows) {
      const total = (p.games_1v1_21 || 0) + (p.games_1v1_11 || 0) + (p.games_2v2_21 || 0) + (p.games_2v2_11 || 0);
      if (total > 0 && (!highestElo || parseFloat(p.score_overall) > highestElo.elo)) {
        highestElo = { name: p.name, elo: Math.round(parseFloat(p.score_overall)) };
      }
    }

    // Most improved (biggest ELO gain from 1000 baseline)
    let mostImproved = null;
    let bestGain = 0;
    for (const p of activePlayers.rows) {
      const total = (p.games_1v1_21 || 0) + (p.games_1v1_11 || 0) + (p.games_2v2_21 || 0) + (p.games_2v2_11 || 0);
      if (total < 3) continue;
      const gain = parseFloat(p.score_overall) - 1000;
      if (gain > bestGain) {
        bestGain = gain;
        mostImproved = { name: p.name, gain: Math.round(gain) };
      }
    }

    // Best win rate (min 5 games)
    const winRateQuery = await db.query(`
      WITH player_wins AS (
        SELECT p.id, p.name,
          (SELECT COUNT(*) FROM matches WHERE (creator_id = p.id OR opponent_id = p.id) AND deleted_at IS NULL) +
          (SELECT COUNT(*) FROM team_matches WHERE (p1_id = p.id OR p2_id = p.id OR op1_id = p.id OR op2_id = p.id) AND deleted_at IS NULL) as total,
          (SELECT COUNT(*) FROM matches WHERE winner_id = p.id AND deleted_at IS NULL) +
          (SELECT COUNT(*) FROM team_matches WHERE ((p1_id = p.id OR p2_id = p.id) AND team_score > opponent_score) OR ((op1_id = p.id OR op2_id = p.id) AND opponent_score > team_score) AND deleted_at IS NULL) as wins
        FROM players p
        WHERE p.deleted_at IS NULL AND p.approved = TRUE AND p.role != 'admin'
      )
      SELECT name, wins, total, ROUND(wins::numeric / NULLIF(total, 0) * 100) as winrate
      FROM player_wins
      WHERE total >= 5
      ORDER BY winrate DESC
      LIMIT 1
    `);
    const bestWinRate = winRateQuery.rows.length > 0
      ? { name: winRateQuery.rows[0].name, winrate: parseInt(winRateQuery.rows[0].winrate), wins: parseInt(winRateQuery.rows[0].wins), total: parseInt(winRateQuery.rows[0].total) }
      : null;

    // Average score margin
    const avgMarginResult = await db.query(
      'SELECT AVG(ABS(creator_score - opponent_score)) as avg_margin FROM matches WHERE deleted_at IS NULL'
    );
    const avgMargin = avgMarginResult.rows[0].avg_margin
      ? parseFloat(avgMarginResult.rows[0].avg_margin).toFixed(1)
      : '0';

    // Biggest upset
    const upsetQuery = await db.query(`
      SELECT m.creator_score, m.opponent_score, m.winner_id,
        p1.name as creator_name, p2.name as opponent_name,
        p1.score_overall as creator_elo, p2.score_overall as opponent_elo
      FROM matches m
      JOIN players p1 ON m.creator_id = p1.id
      JOIN players p2 ON m.opponent_id = p2.id
      WHERE m.deleted_at IS NULL AND m.winner_id IS NOT NULL
    `);

    let biggestUpset = null;
    let biggestUpsetDiff = 0;
    for (const m of upsetQuery.rows) {
      const creatorElo = parseFloat(m.creator_elo);
      const opponentElo = parseFloat(m.opponent_elo);
      let underdog, favorite, eloDiff;
      if (creatorElo < opponentElo && m.creator_score > m.opponent_score) {
        underdog = m.creator_name;
        favorite = m.opponent_name;
        eloDiff = Math.round(opponentElo - creatorElo);
      } else if (opponentElo < creatorElo && m.opponent_score > m.creator_score) {
        underdog = m.opponent_name;
        favorite = m.creator_name;
        eloDiff = Math.round(creatorElo - opponentElo);
      }
      if (eloDiff && eloDiff > biggestUpsetDiff) {
        biggestUpsetDiff = eloDiff;
        biggestUpset = { underdog, favorite, eloDiff };
      }
    }

    // Longest current win streak
    const allResults = await db.query(`
      SELECT created_at, 'singles' as type, winner_id,
        creator_id as p1, NULL::uuid as p2, opponent_id as o1, NULL::uuid as o2,
        creator_score as s1, opponent_score as s2
      FROM matches WHERE deleted_at IS NULL
      UNION ALL
      SELECT created_at, 'doubles' as type, NULL::uuid as winner_id,
        p1_id as p1, p2_id as p2, op1_id as o1, op2_id as o2,
        team_score as s1, opponent_score as s2
      FROM team_matches WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);

    const playerStreaks = {};
    const playerStreakDone = {};
    for (const r of allResults.rows) {
      const participants = [];
      if (r.type === 'singles') {
        const won = r.winner_id;
        const lost = r.p1 === won ? r.o1 : r.p1;
        participants.push({ id: won, win: true });
        participants.push({ id: lost, win: false });
      } else {
        const team1Won = r.s1 > r.s2;
        participants.push({ id: r.p1, win: team1Won });
        participants.push({ id: r.p2, win: team1Won });
        participants.push({ id: r.o1, win: !team1Won });
        participants.push({ id: r.o2, win: !team1Won });
      }
      for (const { id, win } of participants) {
        if (!id || playerStreakDone[id]) continue;
        if (!playerStreaks[id]) playerStreaks[id] = 0;
        if (win) {
          playerStreaks[id]++;
        } else {
          playerStreakDone[id] = true;
        }
      }
    }

    let longestStreak = null;
    let longestStreakCount = 0;
    for (const [id, count] of Object.entries(playerStreaks)) {
      if (count > longestStreakCount) {
        longestStreakCount = count;
        const nameResult = activePlayers.rows.find(p => p.id === id);
        if (nameResult) {
          longestStreak = { name: nameResult.name, streak: count };
        }
      }
    }

    res.json({
      totalMatches: totalSingles + totalDoubles,
      totalSingles,
      totalDoubles,
      highestElo,
      mostImproved,
      bestWinRate,
      avgMargin,
      biggestUpset,
      longestStreak
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
