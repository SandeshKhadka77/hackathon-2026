const express = require('express');
const {
  getOperationsBoard,
  updateEstimate,
  addAssignment,
  markAssignmentDone,
  recordOutcome,
  updatePipelineStatus,
  simulateScenario,
  autoGeneratePlan,
} = require('../controllers/operationsController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/board', requireAuth, getOperationsBoard);
router.post('/estimate', requireAuth, updateEstimate);
router.post('/simulate', requireAuth, simulateScenario);
router.post('/assignments', requireAuth, addAssignment);
router.post('/auto-plan', requireAuth, autoGeneratePlan);
router.patch('/assignments/:pipelineId/:assignmentId/done', requireAuth, markAssignmentDone);
router.post('/outcome', requireAuth, recordOutcome);
router.patch('/status', requireAuth, updatePipelineStatus);

module.exports = router;
