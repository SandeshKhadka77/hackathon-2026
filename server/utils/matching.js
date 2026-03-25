const { calculateDocumentReadiness, getDaysToDeadline } = require('./scoring');

// Keep scoring checklist intelligence centralized so feed, operations, and exports stay consistent.

const CHECKLIST_MAP = {
  Works: ['Bid Security', 'Work Experience', 'Tax Clearance'],
  Goods: ['Manufacturer Authorization', 'PAN', 'Technical Specs'],
  Consulting: ['CV of Key Experts', 'Firm Registration', 'Tax Clearance'],
  Other: ['PAN/VAT', 'Tax Clearance', 'Company Registration'],
};

const REQUIRED_DOCS = {
  Works: [
    { key: 'panVat', label: 'PAN/VAT Certificate' },
    { key: 'taxClearance', label: 'Tax Clearance' },
    { key: 'companyRegistration', label: 'Company Registration' },
  ],
  Goods: [
    { key: 'panVat', label: 'PAN/VAT Certificate' },
    { key: 'taxClearance', label: 'Tax Clearance' },
    { key: 'companyRegistration', label: 'Company Registration' },
  ],
  Consulting: [
    { key: 'panVat', label: 'PAN/VAT Certificate' },
    { key: 'taxClearance', label: 'Tax Clearance' },
    { key: 'companyRegistration', label: 'Company Registration' },
  ],
  Other: [
    { key: 'panVat', label: 'PAN/VAT Certificate' },
    { key: 'taxClearance', label: 'Tax Clearance' },
    { key: 'companyRegistration', label: 'Company Registration' },
  ],
};

const getChecklistForCategory = (category) => CHECKLIST_MAP[category] || CHECKLIST_MAP.Other;
const getRequiredDocsForCategory = (category) => REQUIRED_DOCS[category] || REQUIRED_DOCS.Other;

const getMatchBreakdown = (tender, user) => {
  if (!user) {
    return [];
  }

  const breakdown = [];

  breakdown.push({
    key: 'category',
    label: 'Category Fit',
    earned: tender.category === user.category ? 45 : 0,
    max: 45,
    detail:
      tender.category === user.category
        ? `Tender category matches your profile (${user.category}).`
        : `Tender category (${tender.category || 'Unknown'}) differs from your profile (${user.category || 'Unknown'}).`,
  });

  const districtMatches = tender.district?.toLowerCase() === user.district?.toLowerCase();
  breakdown.push({
    key: 'district',
    label: 'District Fit',
    earned: districtMatches ? 35 : 0,
    max: 35,
    detail: districtMatches
      ? `District match found (${user.district}).`
      : `Tender district (${tender.district || 'Unknown'}) differs from your location (${user.district || 'Unknown'}).`,
  });

  let budgetScore = 0;
  let budgetDetail = 'Tender amount unavailable. Partial score assigned.';
  if (typeof tender.amount === 'number' && tender.amount > 0) {
    if (tender.amount <= Number(user.capacity || 0)) {
      budgetScore = 20;
      budgetDetail = `Amount fits your capacity (NPR ${Number(user.capacity || 0).toLocaleString()}).`;
    } else {
      const ratio = Number(user.capacity || 0) > 0 ? tender.amount / user.capacity : 999;
      if (ratio <= 1.2) {
        budgetScore = 8;
        budgetDetail = 'Amount is slightly above capacity but still potentially feasible.';
      } else {
        budgetDetail = 'Amount is significantly above your declared capacity.';
      }
    }
  } else {
    budgetScore = 10;
  }

  breakdown.push({
    key: 'budget',
    label: 'Budget Fit',
    earned: budgetScore,
    max: 20,
    detail: budgetDetail,
  });

  const expertiseTags = Array.isArray(user.expertiseTags) ? user.expertiseTags : [];
  const normalizedTitle = `${tender.title || ''} ${tender.procuringEntity || ''}`.toLowerCase();
  const hasExpertiseSignal = expertiseTags.length
    ? expertiseTags.some((tag) => normalizedTitle.includes(String(tag).toLowerCase()))
    : false;

  breakdown.push({
    key: 'expertise',
    label: 'Expertise Signal',
    earned: hasExpertiseSignal ? 10 : 0,
    max: 10,
    detail: hasExpertiseSignal
      ? 'Tender title/entity contains one or more of your expertise tags.'
      : 'No clear expertise keyword signal found in the tender title/entity.',
  });

  const vendorGroupBonus = {
    Small: 0,
    Medium: 4,
    Large: 6,
    Consortium: 8,
  };

  const vendorScore = vendorGroupBonus[user.vendorGroup] || 0;
  breakdown.push({
    key: 'vendorGroup',
    label: 'Vendor Scale Bonus',
    earned: vendorScore,
    max: 8,
    detail: `Vendor group adjustment applied for ${user.vendorGroup || 'Small'}.`,
  });

  return breakdown;
};

const calculateMatchPercent = (tender, user) => {
  if (!user) {
    return 0;
  }

  const score = getMatchBreakdown(tender, user).reduce((acc, item) => acc + Number(item.earned || 0), 0);
  return Math.min(100, Math.round(score));
};

const getDeadlineRisk = (deadlineAt) => {
  const daysLeft = getDaysToDeadline(deadlineAt);

  if (daysLeft == null) {
    return {
      level: 'unknown',
      label: 'Unknown',
      daysLeft: null,
      recommendation: 'Verify deadline from notice before committing resources.',
    };
  }

  if (daysLeft < 0) {
    return {
      level: 'closed',
      label: 'Closed',
      daysLeft,
      recommendation: 'Tender deadline has passed.',
    };
  }

  if (daysLeft <= 2) {
    return {
      level: 'critical',
      label: 'Critical',
      daysLeft,
      recommendation: 'Prioritize immediate task assignment and document finalization.',
    };
  }

  if (daysLeft <= 7) {
    return {
      level: 'high',
      label: 'High',
      daysLeft,
      recommendation: 'Track progress daily and close document gaps now.',
    };
  }

  if (daysLeft <= 14) {
    return {
      level: 'medium',
      label: 'Medium',
      daysLeft,
      recommendation: 'Start bid preparation and assign owners this week.',
    };
  }

  return {
    level: 'low',
    label: 'Low',
    daysLeft,
    recommendation: 'Good planning window. Optimize bid quality and costing.',
  };
};

const getDocumentGap = (documents = {}, category = 'Other') => {
  // Document readiness is intentionally category-aware to keep checklist and compliance aligned.
  const required = getRequiredDocsForCategory(category);
  const missing = [];
  const expiringSoon = [];
  const expired = [];

  let readinessPoints = 0;
  required.forEach((item) => {
    const doc = documents?.[item.key];
    if (!doc) {
      missing.push(item.label);
      return;
    }

    const daysLeft = getDaysToDeadline(doc.expiresAt);
    if (daysLeft == null) {
      readinessPoints += 100;
      return;
    }

    if (daysLeft < 0) {
      expired.push(item.label);
      readinessPoints += 20;
    } else if (daysLeft <= 30) {
      expiringSoon.push(`${item.label} (${daysLeft} day(s))`);
      readinessPoints += 70;
    } else {
      readinessPoints += 100;
    }
  });

  const readyPercent = required.length
    ? Math.round(readinessPoints / required.length)
    : calculateDocumentReadiness(documents);

  return {
    required: required.map((item) => item.label),
    missing,
    expiringSoon,
    expired,
    readyPercent,
    status: !missing.length && !expired.length ? 'ready' : 'action-needed',
  };
};

const getGoNoGoRecommendation = ({ matchPercent, deadlineRisk, documentGap }) => {
  if (deadlineRisk.level === 'closed') {
    return {
      decision: 'no-go',
      confidence: 100,
      reason: 'Deadline has passed.',
    };
  }

  const hasDocumentBlockers = documentGap.missing.length > 0 || documentGap.expired.length > 0;

  if (matchPercent >= 75 && !hasDocumentBlockers && ['low', 'medium', 'high'].includes(deadlineRisk.level)) {
    return {
      decision: 'go',
      confidence: Math.min(99, Math.max(70, Math.round(matchPercent * 0.9))),
      reason: 'Strong fit with acceptable timeline and document readiness.',
    };
  }

  if (matchPercent >= 55 && deadlineRisk.level !== 'closed') {
    return {
      decision: 'hold',
      confidence: Math.min(92, Math.max(60, Math.round(matchPercent * 0.85))),
      reason: hasDocumentBlockers
        ? 'Moderate fit, but document gaps must be resolved first.'
        : 'Moderate fit. Review costs and assign owners before committing.',
    };
  }

  return {
    decision: 'no-go',
    confidence: Math.min(95, Math.max(65, 100 - matchPercent)),
    reason: 'Low match score relative to profile and opportunity quality.',
  };
};

const getDecisionLabel = (decision) => {
  if (decision === 'go') return 'Go';
  if (decision === 'hold') return 'Hold';
  return 'No-Go';
};

const buildMatchInsights = (tender, user) => {
  // One assembled insight payload reduces duplicated logic across API responses.
  const breakdown = getMatchBreakdown(tender, user);
  const matchPercent = calculateMatchPercent(tender, user);
  const deadlineRisk = getDeadlineRisk(tender.deadlineAt);
  const documentGap = getDocumentGap(user?.documents || {}, tender.category);
  const recommendation = getGoNoGoRecommendation({ matchPercent, deadlineRisk, documentGap });

  const topReasons = [...breakdown]
    .sort((a, b) => b.earned - a.earned)
    .slice(0, 5)
    .map((item) => ({
      title: item.label,
      score: item.earned,
      max: item.max,
      detail: item.detail,
    }));

  return {
    matchPercent,
    breakdown,
    topReasons,
    deadlineRisk,
    documentGap,
    recommendation: {
      ...recommendation,
      label: getDecisionLabel(recommendation.decision),
    },
    executiveSummary:
      `${getDecisionLabel(recommendation.decision)} (${recommendation.confidence}% confidence). ` +
      `Match ${matchPercent}%, deadline risk ${deadlineRisk.label.toLowerCase()}, document readiness ${documentGap.readyPercent}%.`,
  };
};

module.exports = {
  calculateMatchPercent,
  buildMatchInsights,
  getChecklistForCategory,
  getRequiredDocsForCategory,
};
