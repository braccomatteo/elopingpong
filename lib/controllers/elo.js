const db = require('../db');

const OVERALL_WEIGHTS = {
  score_1v1_21: 0.4,
  score_1v1_11: 0.3,
  score_2v2_21: 0.2,
  score_2v2_11: 0.1
};

function computeExpected(e1, e2) {
  return 1 / (1 + Math.pow(10, (e2 - e1) / 400));
}

function computeExpectedDoubles(e1, e2, e3, e4) {
  return (
    computeExpected(e1, e3) + computeExpected(e1, e4) +
    computeExpected(e2, e3) + computeExpected(e2, e4)
  ) / 4;
}

function getK(gamesPlayed) {
  return Math.max(32 - gamesPlayed, 16);
}

function getMultiplier(scoreDiff, maxScore) {
  if (scoreDiff <= 0) return 1;
  return 1 + 0.1 * Math.log(1 + scoreDiff) / Math.log(1 + maxScore);
}

function computeOverall(scores) {
  return 1000 +
    OVERALL_WEIGHTS.score_1v1_21 * (scores.score_1v1_21 - 1000) +
    OVERALL_WEIGHTS.score_1v1_11 * (scores.score_1v1_11 - 1000) +
    OVERALL_WEIGHTS.score_2v2_21 * (scores.score_2v2_21 - 1000) +
    OVERALL_WEIGHTS.score_2v2_11 * (scores.score_2v2_11 - 1000);
}

async function recalculateAll() {
  try {
    await db.query('BEGIN');

    // Read ALL players for replay (including admins, so their matches aren't skipped)
    const allPlayersResult = await db.query("SELECT id, name, role FROM players WHERE deleted_at IS NULL");
    const playerNames = {};
    for (const p of allPlayersResult.rows) playerNames[p.id] = p.name;

    // Only non-admin IDs get their scores written back (except player-admins like Matteo Bracco)
    const playerIds = allPlayersResult.rows.filter(p => p.name !== 'Admin').map(p => p.id);

    // Initialize in-memory scores and game counters for ALL players
    const playerScores = {};
    const gameCounts = {};
    const catCounts = {};
    const prevOverall = {};
    const prevCat = {};
    for (const p of allPlayersResult.rows) {
      const id = p.id;
      playerScores[id] = {
        score_1v1_21: 1000,
        score_1v1_11: 1000,
        score_2v2_21: 1000,
        score_2v2_11: 1000
      };
      gameCounts[id] = 0;
      catCounts[id] = { games_1v1_21: 0, games_1v1_11: 0, games_2v2_21: 0, games_2v2_11: 0 };
      prevOverall[id] = 1000;
      prevCat[id] = { score_1v1_21: 1000, score_1v1_11: 1000, score_2v2_21: 1000, score_2v2_11: 1000 };
    }

    // Read all matches from both tables
    const singlesResult = await db.query(
      "SELECT id, creator_id, opponent_id, creator_score, opponent_score, points_type, created_at, 'singles' as match_type FROM matches WHERE deleted_at IS NULL ORDER BY created_at ASC, id ASC"
    );
    const doublesResult = await db.query(
      "SELECT id, p1_id, p2_id, op1_id, op2_id, team_score, opponent_score, points_type, created_at, 'doubles' as match_type FROM team_matches WHERE deleted_at IS NULL ORDER BY created_at ASC, id ASC"
    );

    // Merge and sort chronologically for global K tracking
    const allMatches = [...singlesResult.rows, ...doublesResult.rows]
      .sort((a, b) => {
        const timeDiff = new Date(a.created_at) - new Date(b.created_at);
        if (timeDiff !== 0) return timeDiff;
        return a.id < b.id ? -1 : 1;
      });

    // Replay all matches — also track biggest upset
    let biggestUpsetDiff = 0;
    let biggestUpset = null;

    for (const match of allMatches) {
      const maxScore = match.points_type || 21;

      if (match.match_type === 'singles') {
        const field = match.points_type === 11 ? 'score_1v1_11' : 'score_1v1_21';
        const cId = match.creator_id;
        const oId = match.opponent_id;

        if (!playerScores[cId] || !playerScores[oId]) continue;

        // Check for upset using pre-match overall ELO
        const cOverall = computeOverall(playerScores[cId]);
        const oOverall = computeOverall(playerScores[oId]);
        const cWon = match.creator_score > match.opponent_score;
        if (cWon && cOverall < oOverall) {
          const diff = Math.round(oOverall - cOverall);
          if (diff > biggestUpsetDiff) {
            biggestUpsetDiff = diff;
            biggestUpset = { underdog: playerNames[cId], favorite: playerNames[oId], eloDiff: diff };
          }
        } else if (!cWon && oOverall < cOverall) {
          const diff = Math.round(cOverall - oOverall);
          if (diff > biggestUpsetDiff) {
            biggestUpsetDiff = diff;
            biggestUpset = { underdog: playerNames[oId], favorite: playerNames[cId], eloDiff: diff };
          }
        }

        const cRating = playerScores[cId][field];
        const oRating = playerScores[oId][field];
        const scoreDiff = Math.abs(match.creator_score - match.opponent_score);
        const multiplier = getMultiplier(scoreDiff, maxScore);

        const cExpected = computeExpected(cRating, oRating);
        const cOutcome = cWon ? 1 : 0;
        const oOutcome = 1 - cOutcome;
        const oExpected = 1 - cExpected;

        const cDelta = getK(gameCounts[cId]) * (cOutcome - cExpected) * multiplier;
        const oDelta = getK(gameCounts[oId]) * (oOutcome - oExpected) * multiplier;

        // Snapshot before applying
        prevOverall[cId] = Math.max(computeOverall(playerScores[cId]), 0);
        prevOverall[oId] = Math.max(computeOverall(playerScores[oId]), 0);
        prevCat[cId][field] = playerScores[cId][field];
        prevCat[oId][field] = playerScores[oId][field];

        playerScores[cId][field] = Math.max(playerScores[cId][field] + cDelta, 0);
        playerScores[oId][field] = Math.max(playerScores[oId][field] + oDelta, 0);

        gameCounts[cId]++;
        gameCounts[oId]++;
        catCounts[cId][field === 'score_1v1_11' ? 'games_1v1_11' : 'games_1v1_21']++;
        catCounts[oId][field === 'score_1v1_11' ? 'games_1v1_11' : 'games_1v1_21']++;

      } else {
        const field = match.points_type === 11 ? 'score_2v2_11' : 'score_2v2_21';
        const p1 = match.p1_id;
        const p2 = match.p2_id;
        const op1 = match.op1_id;
        const op2 = match.op2_id;

        if (!playerScores[p1] || !playerScores[p2] || !playerScores[op1] || !playerScores[op2]) continue;

        const team1Won = match.team_score > match.opponent_score;
        const scoreDiff = Math.abs(match.team_score - match.opponent_score);
        const multiplier = getMultiplier(scoreDiff, maxScore);

        const expectedTeam1 = computeExpectedDoubles(
          playerScores[p1][field], playerScores[p2][field],
          playerScores[op1][field], playerScores[op2][field]
        );

        const t1Outcome = team1Won ? 1 : 0;
        const t2Outcome = 1 - t1Outcome;
        const expectedTeam2 = 1 - expectedTeam1;

        for (const id of [p1, p2]) {
          prevOverall[id] = Math.max(computeOverall(playerScores[id]), 0);
          prevCat[id][field] = playerScores[id][field];
          const delta = getK(gameCounts[id]) * (t1Outcome - expectedTeam1) * multiplier;
          playerScores[id][field] = Math.max(playerScores[id][field] + delta, 0);
          gameCounts[id]++;
          catCounts[id][field === 'score_2v2_11' ? 'games_2v2_11' : 'games_2v2_21']++;
        }

        for (const id of [op1, op2]) {
          prevOverall[id] = Math.max(computeOverall(playerScores[id]), 0);
          prevCat[id][field] = playerScores[id][field];
          const delta = getK(gameCounts[id]) * (t2Outcome - expectedTeam2) * multiplier;
          playerScores[id][field] = Math.max(playerScores[id][field] + delta, 0);
          gameCounts[id]++;
          catCounts[id][field === 'score_2v2_11' ? 'games_2v2_11' : 'games_2v2_21']++;
        }
      }
    }

    // Compute overall and write final scores
    for (const id of playerIds) {
      const s = playerScores[id];
      const overall = Math.max(computeOverall(s), 0);
      const deltaOverall = overall - prevOverall[id];
      const delta1v1_21 = s.score_1v1_21 - prevCat[id].score_1v1_21;
      const delta1v1_11 = s.score_1v1_11 - prevCat[id].score_1v1_11;
      const delta2v2_21 = s.score_2v2_21 - prevCat[id].score_2v2_21;
      const delta2v2_11 = s.score_2v2_11 - prevCat[id].score_2v2_11;

      await db.query(
        'UPDATE players SET score_overall = $1, score_1v1_21 = $2, score_1v1_11 = $3, score_2v2_21 = $4, score_2v2_11 = $5, games_1v1_21 = $6, games_1v1_11 = $7, games_2v2_21 = $8, games_2v2_11 = $9, last_delta_overall = $10, last_delta_1v1_21 = $11, last_delta_1v1_11 = $12, last_delta_2v2_21 = $13, last_delta_2v2_11 = $14 WHERE id = $15',
        [overall, s.score_1v1_21, s.score_1v1_11, s.score_2v2_21, s.score_2v2_11, catCounts[id].games_1v1_21, catCounts[id].games_1v1_11, catCounts[id].games_2v2_21, catCounts[id].games_2v2_11, deltaOverall, delta1v1_21, delta1v1_11, delta2v2_21, delta2v2_11, id]
      );
    }

    try {
      await db.query(
        `UPDATE global_stats SET biggest_upset_underdog = $1, biggest_upset_favorite = $2, biggest_upset_elo_diff = $3 WHERE id = 1`,
        [biggestUpset ? biggestUpset.underdog : null, biggestUpset ? biggestUpset.favorite : null, biggestUpset ? biggestUpset.eloDiff : 0]
      );
    } catch (_) { /* global_stats table may not exist yet */ }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error recalculating scores:', err);
    throw err;
  }
}

module.exports = { recalculateAll, computeExpected, computeExpectedDoubles, getK, getMultiplier, computeOverall };
