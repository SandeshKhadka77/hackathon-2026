const Tender = require('../models/Tender');
const User = require('../models/User');
const VendorPipeline = require('../models/VendorPipeline');
const { buildMatchInsights, getChecklistForCategory } = require('../utils/matching');
const {
  calculateDocumentReadiness,
  calculateUrgencyScore,
  calculateAssignmentProgress,
  calculateBudgetFit,
  calculateFeasibilityScore,
} = require('../utils/scoring');

const getClosingBucket = (deadlineAt) => {
  if (!deadlineAt) {
    return 'no-deadline';
  }

  const diffDays = Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'closed';
  if (diffDays <= 2) return 'closing-soon';
  if (diffDays <= 7) return 'this-week';
  return 'upcoming';
};

const ensurePipeline = async (userId, tenderId) => {
  // Upsert keeps downstream estimate/assignment calls idempotent for first-time tracked tenders.
  await VendorPipeline.updateOne(
    { user: userId, tender: tenderId },
    { $setOnInsert: { user: userId, tender: tenderId } },
    { upsert: true }
  );

  return VendorPipeline.findOne({ user: userId, tender: tenderId });
};

const toNumber = (value) => Number(value || 0);

const getDueDateFromDays = (days = 1) => {
  const dueAt = new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000);
  dueAt.setHours(17, 0, 0, 0);
  return dueAt;
};

const getOperationsBoard = async (req, res) => {
  try {
    const user = req.user;
    const readinessScore = calculateDocumentReadiness(user.documents || {});

    const [pipelines, recommendations, bookmarks] = await Promise.all([
      VendorPipeline.find({ user: user._id }).populate('tender').sort({ updatedAt: -1 }).limit(25),
      Tender.find({ district: user.district, category: user.category, isActive: true }).sort({ deadlineAt: 1 }).limit(25),
      User.findById(user._id).select('bookmarks').populate('bookmarks'),
    ]);

    const recommendationItems = recommendations
      .map((item) => {
        const payload = item.toObject();
        const insight = buildMatchInsights(payload, user);
        const matchPercent = insight.matchPercent;
        const urgencyScore = calculateUrgencyScore(payload.deadlineAt);
        const feasibilityScore = calculateFeasibilityScore({
          matchPercent,
          readinessScore,
          urgencyScore,
          estimatedTotal: 0,
          capacity: Number(user.capacity || 0),
        });

        return {
          ...payload,
          matchPercent,
          urgencyScore,
          feasibilityScore,
          recommendation: insight.recommendation,
          deadlineRisk: insight.deadlineRisk,
          documentGap: insight.documentGap,
          executiveSummary: insight.executiveSummary,
          deadlineBucket: getClosingBucket(payload.deadlineAt),
        };
      })
      .filter((item) => item.matchPercent >= 50)
      .slice(0, 12);

    const timeline = recommendationItems.reduce(
      (acc, item) => {
        if (item.deadlineBucket === 'closing-soon') acc.closingSoon.push(item);
        else if (item.deadlineBucket === 'this-week') acc.thisWeek.push(item);
        else if (item.deadlineBucket === 'upcoming') acc.upcoming.push(item);
        return acc;
      },
      { closingSoon: [], thisWeek: [], upcoming: [] }
    );

    const pipelineItems = pipelines.map((item) => {
      const estimate = item.estimate || {};
      const estimatedTotal =
        Number(estimate.emdAmount || 0) +
        Number(estimate.documentCost || 0) +
        Number(estimate.logisticsCost || 0) +
        Number(estimate.laborCost || 0) +
        Number(estimate.contingencyCost || 0);

      const tenderPayload = item.tender?.toObject ? item.tender.toObject() : item.tender;
      const insight = tenderPayload ? buildMatchInsights(tenderPayload, user) : null;
      const matchPercent = insight ? insight.matchPercent : 0;
      const urgencyScore = calculateUrgencyScore(tenderPayload?.deadlineAt);
      const assignmentProgress = calculateAssignmentProgress(item.assignments || []);
      const feasibilityScore = calculateFeasibilityScore({
        matchPercent,
        readinessScore,
        urgencyScore,
        estimatedTotal,
        capacity: Number(user.capacity || 0),
      });

      return {
        ...item.toObject(),
        estimatedTotal,
        assignmentProgress,
        matchPercent,
        urgencyScore,
        feasibilityScore,
        recommendation: insight?.recommendation,
        deadlineRisk: insight?.deadlineRisk,
        documentGap: insight?.documentGap,
      };
    });

    const averageFeasibility = pipelineItems.length
      ? Math.round(
          pipelineItems.reduce((acc, item) => acc + Number(item.feasibilityScore || 0), 0) / pipelineItems.length
        )
      : recommendationItems.length
        ? Math.round(
            recommendationItems.reduce((acc, item) => acc + Number(item.feasibilityScore || 0), 0) /
              recommendationItems.length
          )
        : 0;

    const averageAssignmentProgress = pipelineItems.length
      ? Math.round(
          pipelineItems.reduce((acc, item) => acc + Number(item.assignmentProgress || 0), 0) / pipelineItems.length
        )
      : 0;

    return res.json({
      timeline,
      pipelines: pipelineItems,
      trackedTenders: bookmarks?.bookmarks || [],
      recommendations: recommendationItems,
      summary: {
        readinessScore,
        averageFeasibility,
        averageAssignmentProgress,
        highUrgencyCount: recommendationItems.filter((item) => item.urgencyScore >= 70).length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load operations board.', error: error.message });
  }
};

const updateEstimate = async (req, res) => {
  try {
    const { tenderId, emdAmount, documentCost, logisticsCost, laborCost, contingencyCost, notes } = req.body;

    if (!tenderId) {
      return res.status(400).json({ message: 'tenderId is required.' });
    }

    const pipeline = await ensurePipeline(req.user._id, tenderId);

    pipeline.estimate = {
      emdAmount: Number(emdAmount || 0),
      documentCost: Number(documentCost || 0),
      logisticsCost: Number(logisticsCost || 0),
      laborCost: Number(laborCost || 0),
      contingencyCost: Number(contingencyCost || 0),
      notes: notes || '',
    };

    if (pipeline.status === 'watching') {
      pipeline.status = 'preparing';
    }

    await pipeline.save();
    return res.json({ message: 'Estimate updated.', pipeline });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update estimate.', error: error.message });
  }
};

const addAssignment = async (req, res) => {
  try {
    const { tenderId, memberName, role, task, dueAt } = req.body;

    if (!tenderId || !memberName || !role || !task) {
      return res.status(400).json({ message: 'tenderId, memberName, role and task are required.' });
    }

    const pipeline = await ensurePipeline(req.user._id, tenderId);
    pipeline.assignments.push({ memberName, role, task, dueAt: dueAt || null });

    if (pipeline.status === 'watching') {
      pipeline.status = 'preparing';
    }

    await pipeline.save();
    return res.status(201).json({ message: 'Assignment added.', pipeline });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add assignment.', error: error.message });
  }
};

const markAssignmentDone = async (req, res) => {
  try {
    const { pipelineId, assignmentId } = req.params;

    const pipeline = await VendorPipeline.findOne({ _id: pipelineId, user: req.user._id });
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found.' });
    }

    const assignment = pipeline.assignments.id(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    assignment.done = true;
    await pipeline.save();

    return res.json({ message: 'Assignment marked as done.', pipeline });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update assignment.', error: error.message });
  }
};

const recordOutcome = async (req, res) => {
  try {
    const { tenderId, result, reason, learning } = req.body;

    if (!tenderId || !result) {
      return res.status(400).json({ message: 'tenderId and result are required.' });
    }

    const pipeline = await ensurePipeline(req.user._id, tenderId);

    pipeline.outcome = {
      result,
      reason: reason || '',
      learning: learning || '',
      recordedAt: new Date(),
    };

    if (result === 'won') pipeline.status = 'won';
    else if (result === 'lost' || result === 'withdrawn') pipeline.status = 'lost';
    else if (pipeline.status === 'watching') pipeline.status = 'submitted';

    await pipeline.save();

    return res.json({ message: 'Outcome recorded.', pipeline });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record outcome.', error: error.message });
  }
};

const updatePipelineStatus = async (req, res) => {
  try {
    const { tenderId, status, priority } = req.body;

    if (!tenderId) {
      return res.status(400).json({ message: 'tenderId is required.' });
    }

    const pipeline = await ensurePipeline(req.user._id, tenderId);

    if (status) {
      pipeline.status = status;
    }

    if (priority) {
      pipeline.priority = priority;
    }

    await pipeline.save();

    return res.json({ message: 'Pipeline updated.', pipeline });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update pipeline status.', error: error.message });
  }
};

const simulateScenario = async (req, res) => {
  try {
    const { tenderId, emdAmount, documentCost, logisticsCost, laborCost, contingencyCost } = req.body;

    if (!tenderId) {
      return res.status(400).json({ message: 'tenderId is required.' });
    }

    const tender = await Tender.findById(tenderId);
    if (!tender) {
      return res.status(404).json({ message: 'Tender not found.' });
    }

    const user = req.user;
    const payload = tender.toObject();
    const insight = buildMatchInsights(payload, user);
    const readinessScore = calculateDocumentReadiness(user.documents || {});
    const urgencyScore = calculateUrgencyScore(payload.deadlineAt);

    const estimatedTotal =
      toNumber(emdAmount) +
      toNumber(documentCost) +
      toNumber(logisticsCost) +
      toNumber(laborCost) +
      toNumber(contingencyCost);

    const capacity = Number(user.capacity || 0);
    const budgetFit = calculateBudgetFit({ estimatedTotal, capacity });
    const feasibilityScore = calculateFeasibilityScore({
      matchPercent: insight.matchPercent,
      readinessScore,
      urgencyScore,
      estimatedTotal,
      capacity,
    });

    const costRiskLevel = budgetFit >= 80 ? 'low' : budgetFit >= 60 ? 'medium' : 'high';

    return res.json({
      tenderId,
      estimatedTotal,
      matchPercent: insight.matchPercent,
      readinessScore,
      urgencyScore,
      budgetFit,
      feasibilityScore,
      costRiskLevel,
      recommendation: insight.recommendation,
      note:
        costRiskLevel === 'high'
          ? 'Cost profile is aggressive versus declared capacity. Consider scope or partner adjustment.'
          : costRiskLevel === 'medium'
            ? 'Cost profile is feasible but needs tighter budgeting.'
            : 'Cost profile is healthy for your capacity.',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to simulate scenario.', error: error.message });
  }
};

const autoGeneratePlan = async (req, res) => {
  try {
    const { tenderId } = req.body;

    if (!tenderId) {
      return res.status(400).json({ message: 'tenderId is required.' });
    }

    const tender = await Tender.findById(tenderId);
    if (!tender) {
      return res.status(404).json({ message: 'Tender not found.' });
    }

    const payload = tender.toObject();
    const insight = buildMatchInsights(payload, req.user);
    const checklist = getChecklistForCategory(payload.category);

    const pipeline = await ensurePipeline(req.user._id, tenderId);
    // Normalize existing tasks to avoid generating duplicate plan steps on repeated calls.
    const existingTasks = new Set((pipeline.assignments || []).map((item) => String(item.task || '').toLowerCase()));

    const daysLeft = insight.deadlineRisk.daysLeft == null ? 10 : insight.deadlineRisk.daysLeft;
    const dueBase = daysLeft <= 2 ? 1 : daysLeft <= 7 ? 2 : 4;

    const generated = [];
    const planSeed = [
      { task: 'Review tender notice and scope', role: 'Lead', dueInDays: Math.max(1, dueBase - 1) },
      { task: 'Finalize bid cost and pricing sheet', role: 'Finance', dueInDays: dueBase },
      { task: 'Compile technical response package', role: 'Technical', dueInDays: dueBase + 1 },
      { task: 'Perform final compliance check', role: 'Compliance', dueInDays: dueBase + 1 },
    ];

    checklist.forEach((item, index) => {
      planSeed.push({
        task: `Prepare: ${item}`,
        role: 'Compliance',
        dueInDays: Math.max(1, dueBase + Math.floor(index / 2)),
      });
    });

    for (const step of planSeed) {
      if (existingTasks.has(step.task.toLowerCase())) {
        continue;
      }

      const assignment = {
        memberName: 'Auto Planner',
        role: step.role,
        task: step.task,
        dueAt: getDueDateFromDays(step.dueInDays),
      };

      pipeline.assignments.push(assignment);
      generated.push(assignment);
    }

    if (pipeline.status === 'watching') {
      pipeline.status = 'preparing';
    }

    await pipeline.save();

    return res.status(201).json({
      message: generated.length ? 'Auto plan generated.' : 'Auto plan already up to date.',
      generatedCount: generated.length,
      generated,
      recommendation: insight.recommendation,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate auto plan.', error: error.message });
  }
};

module.exports = {
  getOperationsBoard,
  updateEstimate,
  addAssignment,
  markAssignmentDone,
  recordOutcome,
  updatePipelineStatus,
  simulateScenario,
  autoGeneratePlan,
};
