const express = require('express');
const { getMatches } = require('../controllers/matchController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, getMatches);

module.exports = router;
