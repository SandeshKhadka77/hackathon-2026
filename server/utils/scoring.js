const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const calculateBudgetFit = ({ estimatedTotal = 0, capacity = 0 }) => {
  let budgetFit = 60;

  if (capacity > 0 && estimatedTotal > 0) {
    const ratio = estimatedTotal / capacity;
    if (ratio <= 0.4) budgetFit = 95;
    else if (ratio <= 0.7) budgetFit = 80;
    else if (ratio <= 1) budgetFit = 65;
    else budgetFit = 35;
  }

  return budgetFit;
};

const getDaysToDeadline = (deadlineAt) => {
  if (!deadlineAt) {
    return null;
  }

  const diff = new Date(deadlineAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const calculateUrgencyScore = (deadlineAt) => {
  const days = getDaysToDeadline(deadlineAt);
  if (days == null) {
    return 20;
  }

  if (days < 0) return 0;
  if (days <= 1) return 100;
  if (days <= 3) return 85;
  if (days <= 7) return 70;
  if (days <= 14) return 50;
  return 30;
};

const getAlertLevel = (alertScore) => {
  if (alertScore >= 85) return 'critical';
  if (alertScore >= 70) return 'high';
  if (alertScore >= 50) return 'medium';
  return 'low';
};

const calculateAlertScore = ({ matchPercent = 0, deadlineAt, parseConfidence = 70 }) => {
  const urgency = calculateUrgencyScore(deadlineAt);
  const score = Math.round(matchPercent * 0.6 + urgency * 0.25 + parseConfidence * 0.15);
  return clamp(score, 0, 100);
};

const calculateDocumentReadiness = (documents = {}) => {
  const keys = ['panVat', 'taxClearance', 'companyRegistration'];

  let score = 0;
  for (const key of keys) {
    const doc = documents[key];
    if (!doc) {
      continue;
    }

    if (!doc.expiresAt) {
      score += 33;
      continue;
    }

    const days = getDaysToDeadline(doc.expiresAt);
    if (days == null) {
      score += 33;
    } else if (days < 0) {
      score += 5;
    } else if (days <= 7) {
      score += 18;
    } else if (days <= 30) {
      score += 24;
    } else {
      score += 33;
    }
  }

  return clamp(Math.round(score), 0, 100);
};

const calculateAssignmentProgress = (assignments = []) => {
  if (!assignments.length) {
    return 0;
  }

  const doneCount = assignments.filter((item) => item.done).length;
  return Math.round((doneCount / assignments.length) * 100);
};

const calculateFeasibilityScore = ({
  matchPercent = 0,
  readinessScore = 0,
  urgencyScore = 0,
  estimatedTotal = 0,
  capacity = 0,
}) => {
  const budgetFit = calculateBudgetFit({ estimatedTotal, capacity });

  const score = Math.round(matchPercent * 0.42 + readinessScore * 0.33 + budgetFit * 0.15 + urgencyScore * 0.1);
  return clamp(score, 0, 100);
};

module.exports = {
  getDaysToDeadline,
  calculateUrgencyScore,
  calculateAlertScore,
  getAlertLevel,
  calculateDocumentReadiness,
  calculateAssignmentProgress,
  calculateBudgetFit,
  calculateFeasibilityScore,
};
