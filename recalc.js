require('dotenv').config();
const db = require('./api/db');
const { recalculateScores } = require('./api/controllers/matchController'); // Wait, recalculateScores isn't exported!

async function manualRecalc() {
    try {
        console.log('Starting manual recalculation of both Singles and Doubles...');
        await db.query('BEGIN');

        // Singles
        await db.query("UPDATE players SET score_overall = 1000, score_1v1_21 = 1000, score_1v1_11 = 1000 WHERE role != 'admin'");
        const matches = await db.query(
            "SELECT * FROM matches WHERE status = 'verified' ORDER BY created_at ASC, id ASC"
        );
        for (const match of matches.rows) {
            const winnerId = match.creator_score > match.opponent_score ? match.creator_id : match.opponent_id;
            const loserId = match.creator_score > match.opponent_score ? match.opponent_id : match.creator_id;

            const specificField = match.points_type === 11 ? 'score_1v1_11' : 'score_1v1_21';

            // Overall
            await db.query('UPDATE players SET score_overall = score_overall + 100 WHERE id = $1', [winnerId]);
            await db.query('UPDATE players SET score_overall = GREATEST(score_overall - 50, 0) WHERE id = $1', [loserId]);

            // Specific
            await db.query(`UPDATE players SET ${specificField} = ${specificField} + 100 WHERE id = $1`, [winnerId]);
            await db.query(`UPDATE players SET ${specificField} = GREATEST(${specificField} - 50, 0) WHERE id = $1`, [loserId]);
        }

        // Doubles
        await db.query("UPDATE players SET score_2v2_21 = 1000, score_2v2_11 = 1000 WHERE role != 'admin'");
        const teamMatches = await db.query(
            'SELECT * FROM team_matches ORDER BY created_at ASC, id ASC'
        );
        for (const match of teamMatches.rows) {
            const isTeam1Winner = match.team_score > match.opponent_score;
            const specificField = match.points_type === 11 ? 'score_2v2_11' : 'score_2v2_21';

            const t1p1 = match.p1_id;
            const t1p2 = match.p2_id;
            const t2p1 = match.op1_id;
            const t2p2 = match.op2_id;

            // Specific Team Match Score & Overall Score for individuals
            if (isTeam1Winner) {
                await db.query(`UPDATE players SET ${specificField} = ${specificField} + 100 WHERE id IN ($1, $2)`, [t1p1, t1p2]);
                await db.query(`UPDATE players SET ${specificField} = GREATEST(${specificField} - 50, 0) WHERE id IN ($1, $2)`, [t2p1, t2p2]);

                await db.query(`UPDATE players SET score_overall = score_overall + 100 WHERE id IN ($1, $2)`, [t1p1, t1p2]);
                await db.query(`UPDATE players SET score_overall = GREATEST(score_overall - 50, 0) WHERE id IN ($1, $2)`, [t2p1, t2p2]);
            } else {
                await db.query(`UPDATE players SET ${specificField} = ${specificField} + 100 WHERE id IN ($1, $2)`, [t2p1, t2p2]);
                await db.query(`UPDATE players SET ${specificField} = GREATEST(${specificField} - 50, 0) WHERE id IN ($1, $2)`, [t1p1, t1p2]);

                await db.query(`UPDATE players SET score_overall = score_overall + 100 WHERE id IN ($1, $2)`, [t2p1, t2p2]);
                await db.query(`UPDATE players SET score_overall = GREATEST(score_overall - 50, 0) WHERE id IN ($1, $2)`, [t1p1, t1p2]);
            }
        }

        await db.query('COMMIT');
        console.log('Recalculation successful!');

        // Print current single scores
        const res = await db.query("SELECT name, score_overall, score_1v1_21, score_1v1_11 FROM players WHERE role != 'admin' ORDER BY score_overall DESC");
        console.log('New Scores:', res.rows);

        process.exit(0);
    } catch (e) {
        await db.query('ROLLBACK');
        console.error(e);
        process.exit(1);
    }
}

manualRecalc();
