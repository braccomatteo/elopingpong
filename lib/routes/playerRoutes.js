const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

// Public: get all players (excludes admin)
router.get('/', playerController.getAllPlayers);

// Protected: update own profile
router.put('/profile', authMiddleware, playerController.updateProfile);

// Admin: delete a player
router.delete('/:id', authMiddleware, adminOnly, playerController.deletePlayer);

module.exports = router;
