const express = require('express');
const router = express.Router();
const { getNotifications, dismissNotification } = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getNotifications);
router.delete('/:id', dismissNotification);

module.exports = router;
