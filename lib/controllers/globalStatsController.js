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

    // Average score margin
    const avgMarginResult = await db.query(
      'SELECT AVG(ABS(creator_score - opponent_score)) as avg_margin FROM matches WHERE deleted_at IS NULL'
    );
    const avgMargin = avgMarginResult.rows[0].avg_margin
      ? parseFloat(avgMarginResult.rows[0].avg_margin).toFixed(1)
      : '0';

    // Biggest upset (persisted by recalculateAll)
    const upsetRow = await db.query('SELECT * FROM global_stats WHERE id = 1');
    const gs = upsetRow.rows[0];
    const biggestUpset = gs && gs.biggest_upset_underdog
      ? { underdog: gs.biggest_upset_underdog, favorite: gs.biggest_upset_favorite, eloDiff: gs.biggest_upset_elo_diff }
      : null;

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
      mostImproved,
      avgMargin,
      biggestUpset,
      longestStreak
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
