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
      "SELECT id, name, score_overall, games_1v1_21, games_1v1_11, games_2v2_21, games_2v2_11 FROM players WHERE deleted_at IS NULL AND approved = TRUE AND name != 'Admin'"
    );

    // Average score margin
    const avgMarginResult = await db.query(
      'SELECT AVG(ABS(creator_score - opponent_score)) as avg_margin FROM matches WHERE deleted_at IS NULL'
    );
    const avgMargin = avgMarginResult.rows[0].avg_margin
      ? parseFloat(avgMarginResult.rows[0].avg_margin).toFixed(1)
      : '0';

    // Close matches (decided by ≤2 points)
    const closeResult = await db.query(`
      SELECT COUNT(*) FROM (
        SELECT ABS(creator_score - opponent_score) as diff FROM matches WHERE deleted_at IS NULL
        UNION ALL
        SELECT ABS(team_score - opponent_score) as diff FROM team_matches WHERE deleted_at IS NULL
      ) t WHERE diff <= 2
    `);
    const totalAll = totalSingles + totalDoubles;
    const closeMatches = totalAll > 0
      ? Math.round((parseInt(closeResult.rows[0].count) / totalAll) * 100)
      : 0;

    // Global stats persisted by recalculateAll (biggest upset + weekly top + consistent)
    let biggestUpset = null;
    let weeklyTop = null;
    let mostConsistent = null;
    try {
      const gsRow = await db.query('SELECT * FROM global_stats WHERE id = 1');
      const gs = gsRow.rows[0];
      if (gs && gs.biggest_upset_underdog) {
        biggestUpset = { underdog: gs.biggest_upset_underdog, favorite: gs.biggest_upset_favorite, eloDiff: gs.biggest_upset_elo_diff };
      }
      if (gs && gs.weekly_top_name && gs.weekly_top_gain > 0) {
        weeklyTop = { name: gs.weekly_top_name, gain: Math.round(gs.weekly_top_gain) };
      }
      if (gs && gs.consistent_name) {
        mostConsistent = { name: gs.consistent_name, stddev: gs.consistent_stddev };
      }
    } catch (_) { /* table may not exist yet */ }

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
      weeklyTop,
      avgMargin,
      closeMatches,
      biggestUpset,
      longestStreak,
      mostConsistent
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getGlobalChartData = async (req, res) => {
  try {
    // Matches per week (last 12 weeks)
    const matchesPerWeek = await db.query(`
      SELECT weeks.week_start, COALESCE(c.cnt, 0) as count FROM (
        SELECT generate_series(
          date_trunc('week', NOW() - interval '11 weeks'),
          date_trunc('week', NOW()),
          '1 week'
        )::date as week_start
      ) weeks
      LEFT JOIN (
        SELECT date_trunc('week', created_at)::date as week_start, COUNT(*) as cnt
        FROM (
          SELECT created_at FROM matches WHERE deleted_at IS NULL
          UNION ALL
          SELECT created_at FROM team_matches WHERE deleted_at IS NULL
        ) all_matches
        GROUP BY 1
      ) c ON weeks.week_start = c.week_start
      ORDER BY weeks.week_start
    `);

    // Category distribution (total matches per category)
    const catDist = await db.query(`
      SELECT
        SUM(CASE WHEN match_type = 'singles' AND points_type = 21 THEN 1 ELSE 0 END) as "1v1_21",
        SUM(CASE WHEN match_type = 'singles' AND points_type = 11 THEN 1 ELSE 0 END) as "1v1_11",
        SUM(CASE WHEN match_type = 'doubles' AND points_type = 21 THEN 1 ELSE 0 END) as "2v2_21",
        SUM(CASE WHEN match_type = 'doubles' AND points_type = 11 THEN 1 ELSE 0 END) as "2v2_11"
      FROM (
        SELECT 'singles' as match_type, points_type FROM matches WHERE deleted_at IS NULL
        UNION ALL
        SELECT 'doubles' as match_type, points_type FROM team_matches WHERE deleted_at IS NULL
      ) t
    `);

    // ELO distribution (bucket active players by ELO range)
    const eloDist = await db.query(`
      SELECT
        FLOOR(score_overall / 25) * 25 as bucket,
        COUNT(*) as count
      FROM players
      WHERE deleted_at IS NULL
        AND approved = TRUE
        AND name != 'Admin'
        AND (games_1v1_21 + games_1v1_11 + games_2v2_21 + games_2v2_11) > 0
      GROUP BY 1
      ORDER BY 1
    `);

    // Matches per hour of day
    const matchesByHour = await db.query(`
      SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
      FROM (
        SELECT created_at FROM matches WHERE deleted_at IS NULL
        UNION ALL
        SELECT created_at FROM team_matches WHERE deleted_at IS NULL
      ) t
      GROUP BY 1
      ORDER BY 1
    `);

    // Top 5 players by company (which companies the top 5 ranked players belong to)
    const top5Company = await db.query(`
      SELECT company, COUNT(*) as count
      FROM (
        SELECT company FROM players
        WHERE deleted_at IS NULL AND approved = TRUE AND name != 'Admin'
          AND company IS NOT NULL AND company != ''
          AND (games_1v1_21 + games_1v1_11 + games_2v2_21 + games_2v2_11) > 0
        ORDER BY score_overall DESC
        LIMIT 5
      ) t
      GROUP BY company
      ORDER BY count DESC
    `);

    // BU distribution (for Data company only — returned always, filtered on frontend)
    const buDist = await db.query(`
      SELECT bu, COUNT(*) as count
      FROM players
      WHERE deleted_at IS NULL AND approved = TRUE AND name != 'Admin'
        AND UPPER(company) = 'DATA'
        AND bu IS NOT NULL AND bu != ''
        AND (games_1v1_21 + games_1v1_11 + games_2v2_21 + games_2v2_11) > 0
      GROUP BY bu
      ORDER BY count DESC
    `);

    res.json({
      matchesPerWeek: matchesPerWeek.rows.map(r => ({
        week: r.week_start,
        count: parseInt(r.count)
      })),
      categoryDistribution: catDist.rows[0] ? {
        '1v1_21': parseInt(catDist.rows[0]['1v1_21']) || 0,
        '1v1_11': parseInt(catDist.rows[0]['1v1_11']) || 0,
        '2v2_21': parseInt(catDist.rows[0]['2v2_21']) || 0,
        '2v2_11': parseInt(catDist.rows[0]['2v2_11']) || 0,
      } : { '1v1_21': 0, '1v1_11': 0, '2v2_21': 0, '2v2_11': 0 },
      eloDistribution: eloDist.rows.map(r => ({
        bucket: parseInt(r.bucket),
        count: parseInt(r.count)
      })),
      matchesByHour: matchesByHour.rows.map(r => ({
        hour: parseInt(r.hour),
        count: parseInt(r.count)
      })),
      top5Company: top5Company.rows.map(r => ({
        company: r.company,
        count: parseInt(r.count)
      })),
      buDistribution: buDist.rows.map(r => ({
        bu: r.bu,
        count: parseInt(r.count)
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
