const express = require('express');
const { listBookmarks, toggleBookmark } = require('../controllers/bookmarkController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, listBookmarks);
router.post('/toggle', requireAuth, toggleBookmark);

module.exports = router;
