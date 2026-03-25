const express = require('express');
const {
  listOrganizationTenders,
  createOrganizationTender,
  updateOrganizationTender,
} = require('../controllers/organizationController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/tenders', requireAuth, requireRole(['organization', 'admin']), listOrganizationTenders);
router.post('/tenders', requireAuth, requireRole(['organization', 'admin']), createOrganizationTender);
router.patch('/tenders/:id', requireAuth, requireRole(['organization', 'admin']), updateOrganizationTender);

module.exports = router;
