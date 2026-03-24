const express = require('express');
const { getDashboardStats, runScraper, sendDigestBatch, getTrendStats } = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', requireAuth, requireRole(['admin']), getDashboardStats);
router.get('/trends', requireAuth, requireRole(['admin']), getTrendStats);
router.post('/run-scraper', requireAuth, requireRole(['admin']), runScraper);
router.post('/send-digests', requireAuth, requireRole(['admin']), sendDigestBatch);

module.exports = router;
