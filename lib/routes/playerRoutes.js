const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

// Public: get all players (excludes admin)
router.get('/', playerController.getAllPlayers);

// Public: get player stats
router.get('/stats/:id', playerController.getPlayerStats);

// Protected: update own profile
router.put('/profile', authMiddleware, playerController.updateProfile);

// Admin: get deleted items (trash)
router.get('/trash', authMiddleware, adminOnly, playerController.getDeletedItems);

// Admin: restore a player
router.post('/restore/:id', authMiddleware, adminOnly, playerController.restorePlayer);

// Admin: permanent delete from trash
router.delete('/trash/player/:id', authMiddleware, adminOnly, playerController.permanentDeletePlayer);
router.delete('/trash/match/:id', authMiddleware, adminOnly, playerController.permanentDeleteMatch);
router.delete('/trash/team-match/:id', authMiddleware, adminOnly, playerController.permanentDeleteTeamMatch);

// Admin: delete a player
router.delete('/:id', authMiddleware, adminOnly, playerController.deletePlayer);

module.exports = router;
