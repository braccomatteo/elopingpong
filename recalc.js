require('dotenv').config();
const db = require('./lib/db');
const { recalculateAll } = require('./lib/controllers/elo');

async function manualRecalc() {
    try {
        console.log('Starting manual recalculation...');
        await recalculateAll();
        console.log('Recalculation successful!');

        const res = await db.query("SELECT name, score_overall::float, score_1v1_21::float, score_1v1_11::float, score_2v2_21::float, score_2v2_11::float FROM players WHERE role != 'admin' ORDER BY score_overall DESC");
        console.log('New Scores:', res.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

manualRecalc();
