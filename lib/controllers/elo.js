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

    // Read all non-admin player IDs
    const playersResult = await db.query("SELECT id FROM players WHERE role != 'admin' AND deleted_at IS NULL");
    const playerIds = playersResult.rows.map(p => p.id);

    // Initialize in-memory scores and game counters
    const playerScores = {};
    const gameCounts = {};
    for (const id of playerIds) {
      playerScores[id] = {
        score_1v1_21: 1000,
        score_1v1_11: 1000,
        score_2v2_21: 1000,
        score_2v2_11: 1000
      };
      gameCounts[id] = 0;
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

    // Replay all matches
    for (const match of allMatches) {
      const maxScore = match.points_type || 21;

      if (match.match_type === 'singles') {
        const field = match.points_type === 11 ? 'score_1v1_11' : 'score_1v1_21';
        const cId = match.creator_id;
        const oId = match.opponent_id;

        if (!playerScores[cId] || !playerScores[oId]) continue;

        const cRating = playerScores[cId][field];
        const oRating = playerScores[oId][field];
        const cWon = match.creator_score > match.opponent_score;
        const scoreDiff = Math.abs(match.creator_score - match.opponent_score);
        const multiplier = getMultiplier(scoreDiff, maxScore);

        const cExpected = computeExpected(cRating, oRating);
        const cOutcome = cWon ? 1 : 0;
        const oOutcome = 1 - cOutcome;
        const oExpected = 1 - cExpected;

        const cDelta = getK(gameCounts[cId]) * (cOutcome - cExpected) * multiplier;
        const oDelta = getK(gameCounts[oId]) * (oOutcome - oExpected) * multiplier;

        playerScores[cId][field] = Math.max(playerScores[cId][field] + cDelta, 0);
        playerScores[oId][field] = Math.max(playerScores[oId][field] + oDelta, 0);

        gameCounts[cId]++;
        gameCounts[oId]++;

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
          const delta = getK(gameCounts[id]) * (t1Outcome - expectedTeam1) * multiplier;
          playerScores[id][field] = Math.max(playerScores[id][field] + delta, 0);
          gameCounts[id]++;
        }

        for (const id of [op1, op2]) {
          const delta = getK(gameCounts[id]) * (t2Outcome - expectedTeam2) * multiplier;
          playerScores[id][field] = Math.max(playerScores[id][field] + delta, 0);
          gameCounts[id]++;
        }
      }
    }

    // Compute overall and write final scores
    for (const id of playerIds) {
      const s = playerScores[id];
      const overall = Math.max(computeOverall(s), 0);

      await db.query(
        'UPDATE players SET score_overall = $1, score_1v1_21 = $2, score_1v1_11 = $3, score_2v2_21 = $4, score_2v2_11 = $5 WHERE id = $6',
        [overall, s.score_1v1_21, s.score_1v1_11, s.score_2v2_21, s.score_2v2_11, id]
      );
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error recalculating scores:', err);
    throw err;
  }
}

module.exports = { recalculateAll };
