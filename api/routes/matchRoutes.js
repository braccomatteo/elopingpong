const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

// Apply auth middleware to all match routes
router.use(authMiddleware);

router.post('/', matchController.createMatch);
router.get('/all', adminOnly, matchController.getAllMatches);
router.delete('/:id', adminOnly, matchController.deleteMatch);
router.post('/admin', adminOnly, matchController.createMatchAdmin);

module.exports = router;
