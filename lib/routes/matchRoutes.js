const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const globalStatsController = require('../controllers/globalStatsController');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

// Public routes
router.get('/history', matchController.getUnifiedHistory);
router.get('/history/player/:playerId', matchController.getPlayerHistory);
router.get('/global-stats', globalStatsController.getGlobalStats);

// Apply auth middleware to all remaining match routes
router.use(authMiddleware);

router.post('/', matchController.createMatch);
router.get('/all', adminOnly, matchController.getAllMatches);
router.delete('/:id', adminOnly, matchController.deleteMatch);
router.post('/restore/:id', adminOnly, matchController.restoreMatch);
router.post('/admin', adminOnly, matchController.createMatchAdmin);

module.exports = router;
