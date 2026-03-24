const express = require('express');
const {
	listNotifications,
	markAsRead,
	getPreferences,
	updatePreferences,
} = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listNotifications);
router.get('/preferences', requireAuth, getPreferences);
router.patch('/preferences', requireAuth, updatePreferences);
router.patch('/:id/read', requireAuth, markAsRead);

module.exports = router;
