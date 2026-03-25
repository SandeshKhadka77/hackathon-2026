const express = require('express');
const { listTenders, getTenderById, exportExecutiveBriefPdf } = require('../controllers/tenderController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', listTenders);
router.get('/personalized', requireAuth, listTenders);
router.get('/:id/executive-brief.pdf', requireAuth, exportExecutiveBriefPdf);
router.get('/:id', getTenderById);

module.exports = router;
