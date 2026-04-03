const db = require('../db');
const { computeExpected, computeExpectedDoubles, getK, getMultiplier, computeOverall } = require('./elo');

exports.getGlobalStats = async (req, res) => {
  try {
    // Total match counts
    const singlesCount = await db.query('SELECT COUNT(*) FROM matches WHERE deleted_at IS NULL');
    const doublesCount = await db.query('SELECT COUNT(*) FROM team_matches WHERE deleted_at IS NULL');
    const totalSingles = parseInt(singlesCount.rows[0].count);
    const totalDoubles = parseInt(doublesCount.rows[0].count);

    // Active players
    const activePlayers = await db.query(
      "SELECT id, name, score_overall, score_1v1_21, score_1v1_11, score_2v2_21, score_2v2_11, games_1v1_21, games_1v1_11, games_2v2_21, games_2v2_11 FROM players WHERE deleted_at IS NULL AND approved = TRUE AND name != 'Admin'"
    );

    // Specialist: biggest gap between best and worst category ELO (min 2 categories played)
    let specialist = null;
    let bestGap = 0;
    for (const p of activePlayers.rows) {
      const played = [];
      if ((p.games_1v1_21 || 0) > 0) played.push(parseFloat(p.score_1v1_21));
      if ((p.games_1v1_11 || 0) > 0) played.push(parseFloat(p.score_1v1_11));
      if ((p.games_2v2_21 || 0) > 0) played.push(parseFloat(p.score_2v2_21));
      if ((p.games_2v2_11 || 0) > 0) played.push(parseFloat(p.score_2v2_11));
      if (played.length < 2) continue;
      const gap = Math.round(Math.max(...played) - Math.min(...played));
      if (gap > bestGap) {
        bestGap = gap;
        specialist = { name: p.name, gap };
      }
    }

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
      mostConsistent,
      specialist
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

    // ELO distribution (bucket active players by ELO range) — overall + per category
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

    const eloDistCats = {};
    for (const [cat, col, gamesCol] of [
      ['1v1_21', 'score_1v1_21', 'games_1v1_21'],
      ['1v1_11', 'score_1v1_11', 'games_1v1_11'],
      ['2v2_21', 'score_2v2_21', 'games_2v2_21'],
      ['2v2_11', 'score_2v2_11', 'games_2v2_11'],
    ]) {
      const res = await db.query(`
        SELECT FLOOR(${col} / 25) * 25 as bucket, COUNT(*) as count
        FROM players
        WHERE deleted_at IS NULL AND approved = TRUE AND name != 'Admin'
          AND ${gamesCol} > 0
        GROUP BY 1 ORDER BY 1
      `);
      eloDistCats[cat] = res.rows.map(r => ({ bucket: parseInt(r.bucket), count: parseInt(r.count) }));
    }

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

    // Avg ELO by company
    const avgEloByCompany = await db.query(`
      SELECT company,
        ROUND(AVG(score_overall)) as avg_elo,
        ROUND(AVG(score_1v1_21)) as avg_1v1_21,
        ROUND(AVG(score_1v1_11)) as avg_1v1_11,
        ROUND(AVG(score_2v2_21)) as avg_2v2_21,
        ROUND(AVG(score_2v2_11)) as avg_2v2_11,
        COUNT(*) as player_count
      FROM players
      WHERE deleted_at IS NULL AND approved = TRUE AND name != 'Admin'
        AND company IS NOT NULL AND company != ''
        AND (games_1v1_21 + games_1v1_11 + games_2v2_21 + games_2v2_11) > 0
      GROUP BY company
      ORDER BY avg_elo DESC
    `);

    // Avg ELO by BU (DATA only)
    const avgEloByBu = await db.query(`
      SELECT bu,
        ROUND(AVG(score_overall)) as avg_elo,
        ROUND(AVG(score_1v1_21)) as avg_1v1_21,
        ROUND(AVG(score_1v1_11)) as avg_1v1_11,
        ROUND(AVG(score_2v2_21)) as avg_2v2_21,
        ROUND(AVG(score_2v2_11)) as avg_2v2_11,
        COUNT(*) as player_count
      FROM players
      WHERE deleted_at IS NULL AND approved = TRUE AND name != 'Admin'
        AND UPPER(company) = 'DATA'
        AND bu IS NOT NULL AND bu != ''
        AND (games_1v1_21 + games_1v1_11 + games_2v2_21 + games_2v2_11) > 0
      GROUP BY bu
      ORDER BY avg_elo DESC
    `);
    // --- On-demand ELO replay for daily avg chart (admin only) ---
    const allPlayers = await db.query("SELECT id, name FROM players WHERE deleted_at IS NULL AND name != 'Admin'");
    const pIds = allPlayers.rows.map(p => p.id);
    const pNames = {};
    const pScores = {};
    const pGames = {};
    const pHistory = {}; // per-player: array of { match (global index), elo }
    for (const p of allPlayers.rows) {
      pNames[p.id] = p.name;
      pScores[p.id] = { score_1v1_21: 1000, score_1v1_11: 1000, score_2v2_21: 1000, score_2v2_11: 1000 };
      pGames[p.id] = 0;
      pHistory[p.id] = [];
    }
    const singles = await db.query("SELECT creator_id, opponent_id, creator_score, opponent_score, points_type, created_at FROM matches WHERE deleted_at IS NULL");
    const doubles = await db.query("SELECT p1_id, p2_id, op1_id, op2_id, team_score, opponent_score, points_type, created_at FROM team_matches WHERE deleted_at IS NULL");
    const allM = [
      ...singles.rows.map(r => ({ ...r, mt: 's' })),
      ...doubles.rows.map(r => ({ ...r, mt: 'd' }))
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const dailySnapshots = {};
    let matchIdx = 0;
    for (const m of allM) {
      matchIdx++;
      const maxS = m.points_type || 21;
      if (m.mt === 's') {
        const f = m.points_type === 11 ? 'score_1v1_11' : 'score_1v1_21';
        const c = m.creator_id, o = m.opponent_id;
        if (!pScores[c] || !pScores[o]) continue;
        const cW = m.creator_score > m.opponent_score;
        const diff = Math.abs(m.creator_score - m.opponent_score);
        const mul = getMultiplier(diff, maxS);
        const cE = computeExpected(pScores[c][f], pScores[o][f]);
        pScores[c][f] = Math.max(pScores[c][f] + getK(pGames[c]) * ((cW ? 1 : 0) - cE) * mul, 0);
        pScores[o][f] = Math.max(pScores[o][f] + getK(pGames[o]) * ((cW ? 0 : 1) - (1 - cE)) * mul, 0);
        pGames[c]++; pGames[o]++;
        for (const id of [c, o]) {
          pHistory[id].push({ match: matchIdx, elo: Math.round(Math.max(computeOverall(pScores[id]), 0)) });
        }
      } else {
        const f = m.points_type === 11 ? 'score_2v2_11' : 'score_2v2_21';
        const { p1_id: p1, p2_id: p2, op1_id: o1, op2_id: o2 } = m;
        if (!pScores[p1] || !pScores[p2] || !pScores[o1] || !pScores[o2]) continue;
        const t1W = m.team_score > m.opponent_score;
        const diff = Math.abs(m.team_score - m.opponent_score);
        const mul = getMultiplier(diff, maxS);
        const eT1 = computeExpectedDoubles(pScores[p1][f], pScores[p2][f], pScores[o1][f], pScores[o2][f]);
        for (const id of [p1, p2]) {
          pScores[id][f] = Math.max(pScores[id][f] + getK(pGames[id]) * ((t1W ? 1 : 0) - eT1) * mul, 0);
          pGames[id]++;
        }
        for (const id of [o1, o2]) {
          pScores[id][f] = Math.max(pScores[id][f] + getK(pGames[id]) * ((t1W ? 0 : 1) - (1 - eT1)) * mul, 0);
          pGames[id]++;
        }
        for (const id of [p1, p2, o1, o2]) {
          pHistory[id].push({ match: matchIdx, elo: Math.round(Math.max(computeOverall(pScores[id]), 0)) });
        }
      }
      // Snapshot: avg overall of active players on this day
      const day = new Date(m.created_at).toISOString().slice(0, 10);
      const activeElos = pIds.filter(id => pGames[id] > 0).map(id => Math.max(computeOverall(pScores[id]), 0));
      dailySnapshots[day] = Math.round(activeElos.reduce((a, b) => a + b, 0) / activeElos.length);
    }
    const avgEloByDay = Object.entries(dailySnapshots).map(([date, avg]) => ({ date, avg }));

    // Build per-player ELO trajectories (only active players)
    const eloTrajectories = pIds
      .filter(id => pHistory[id].length > 0)
      .map(id => ({ name: pNames[id], data: pHistory[id] }));

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
      eloDistributionByCategory: eloDistCats,
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
      avgEloByCompany: avgEloByCompany.rows.map(r => ({
        company: r.company,
        avgElo: parseInt(r.avg_elo),
        avgElo_1v1_21: parseInt(r.avg_1v1_21),
        avgElo_1v1_11: parseInt(r.avg_1v1_11),
        avgElo_2v2_21: parseInt(r.avg_2v2_21),
        avgElo_2v2_11: parseInt(r.avg_2v2_11),
        playerCount: parseInt(r.player_count)
      })),
      avgEloByBu: avgEloByBu.rows.map(r => ({
        bu: r.bu,
        avgElo: parseInt(r.avg_elo),
        avgElo_1v1_21: parseInt(r.avg_1v1_21),
        avgElo_1v1_11: parseInt(r.avg_1v1_11),
        avgElo_2v2_21: parseInt(r.avg_2v2_21),
        avgElo_2v2_11: parseInt(r.avg_2v2_11),
        playerCount: parseInt(r.player_count)
      })),
      avgEloByDay,
      eloTrajectories,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
