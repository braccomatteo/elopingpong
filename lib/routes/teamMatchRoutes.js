const express = require('express');
const router = express.Router();
const teamMatchController = require('../controllers/teamMatchController');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

// Protected: create a team match
router.post('/', authMiddleware, teamMatchController.createTeamMatch);

// Admin: get all team matches (paginated)
router.get('/all', authMiddleware, adminOnly, teamMatchController.getAllTeamMatches);

// Admin: delete a team match
router.delete('/:id', authMiddleware, adminOnly, teamMatchController.deleteTeamMatch);

// Admin: update a team match
router.put('/:id', authMiddleware, adminOnly, teamMatchController.updateTeamMatch);

// Admin: restore a team match
router.post('/restore/:id', authMiddleware, adminOnly, teamMatchController.restoreTeamMatch);

module.exports = router;
