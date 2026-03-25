const express = require('express');
const { joinTenderJv, getTenderJvPartners } = require('../controllers/jvController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/join', requireAuth, joinTenderJv);
router.get('/partners/:tenderId', requireAuth, getTenderJvPartners);

module.exports = router;
