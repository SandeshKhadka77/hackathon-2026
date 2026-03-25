const Tender = require('../models/Tender');
const puppeteer = require('puppeteer');
const { calculateMatchPercent, buildMatchInsights, getChecklistForCategory } = require('../utils/matching');

const parsePositiveNumber = (value) => {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatNpr = (value) => `NPR ${Number(value || 0).toLocaleString()}`;

const toSafeFilename = (value) =>
  String(value || 'tender-brief')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'tender-brief';

const getDecisionPriority = (decision) => {
  if (decision === 'go') return 3;
  if (decision === 'hold') return 2;
  return 1;
};

const getDeadlineSortValue = (deadlineAt) => {
  if (!deadlineAt) {
    return Number.MAX_SAFE_INTEGER;
  }

  const value = new Date(deadlineAt).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
};

const sortPersonalizedItems = (items = []) =>
  [...items].sort((a, b) => {
    const decisionDiff =
      getDecisionPriority(b.insight?.recommendation?.decision) -
      getDecisionPriority(a.insight?.recommendation?.decision);
    if (decisionDiff !== 0) {
      return decisionDiff;
    }

    const matchDiff = Number(b.matchPercent || 0) - Number(a.matchPercent || 0);
    if (matchDiff !== 0) {
      return matchDiff;
    }

    return getDeadlineSortValue(a.deadlineAt) - getDeadlineSortValue(b.deadlineAt);
  });

const listTenders = async (req, res) => {
  try {
    const { q = '', category, district, sourceType, page = 1, limit = 20 } = req.query;
    const amountGte = parsePositiveNumber(req.query.amountGte);
    const amountLte = parsePositiveNumber(req.query.amountLte);
    const deadlineWithinDays = parsePositiveNumber(req.query.deadlineWithinDays);

    const query = { isActive: true };

    if (q.trim()) {
      query.$or = [
        { title: { $regex: q.trim(), $options: 'i' } },
        { tenderId: { $regex: q.trim(), $options: 'i' } },
        { procuringEntity: { $regex: q.trim(), $options: 'i' } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (district) {
      query.district = district;
    }

    if (['ppmo', 'private'].includes(String(sourceType || '').toLowerCase())) {
      const normalizedSourceType = String(sourceType).toLowerCase();
      if (normalizedSourceType === 'ppmo') {
        query.$and = [
          ...(query.$and || []),
          {
            $or: [{ sourceType: 'ppmo' }, { sourceType: { $exists: false } }, { sourceType: null }],
          },
        ];
      } else {
        query.sourceType = normalizedSourceType;
      }
    }

    if (amountGte != null || amountLte != null) {
      query.amount = {};
      if (amountGte != null) {
        query.amount.$gte = amountGte;
      }
      if (amountLte != null) {
        query.amount.$lte = amountLte;
      }
    }

    if (deadlineWithinDays != null && deadlineWithinDays > 0) {
      const now = new Date();
      const upper = new Date(now.getTime() + deadlineWithinDays * 24 * 60 * 60 * 1000);
      query.deadlineAt = {
        $gte: now,
        $lte: upper,
      };
    }

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));

    const total = await Tender.countDocuments(query);

    let mapped = [];

    if (req.user) {
      // Personalized feed should rank best-fit opportunities first, then paginate the ranked list.
      const rankingLimit = Math.max(pageNumber * pageSize, 200);
      const items = await Tender.find(query)
        .sort({ deadlineAt: 1, createdAt: -1 })
        .limit(rankingLimit);

      const scored = items.map((item) => {
        const tender = item.toObject();
        const insight = buildMatchInsights(tender, req.user);

        return {
          ...tender,
          matchPercent: insight.matchPercent,
          checklist: getChecklistForCategory(tender.category),
          insight,
        };
      });

      const ranked = sortPersonalizedItems(scored);
      mapped = ranked.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
    } else {
      const items = await Tender.find(query)
        .sort({ deadlineAt: 1, createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize);

      mapped = items.map((item) => {
        const tender = item.toObject();

        return {
          ...tender,
          matchPercent: 0,
          checklist: getChecklistForCategory(tender.category),
          insight: null,
        };
      });
    }

    return res.json({
      items: mapped,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch tenders.', error: error.message });
  }
};

const getTenderById = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);

    if (!tender) {
      return res.status(404).json({ message: 'Tender not found.' });
    }

    const payload = tender.toObject();
    const insight = req.user ? buildMatchInsights(payload, req.user) : null;

    return res.json({
      ...payload,
      matchPercent: req.user ? insight.matchPercent : calculateMatchPercent(payload, req.user),
      checklist: getChecklistForCategory(payload.category),
      insight,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch tender.', error: error.message });
  }
};

const getMarketSnapshot = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id);

    if (!tender) {
      return res.status(404).json({ message: 'Tender not found.' });
    }

    const now = new Date();
    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [sameCategoryDistrictCount, sameDistrictCount, recentCategoryCount, recentDistrictCount] = await Promise.all([
      Tender.countDocuments({
        isActive: true,
        category: tender.category,
        district: tender.district,
        _id: { $ne: tender._id },
      }),
      Tender.countDocuments({
        isActive: true,
        district: tender.district,
        _id: { $ne: tender._id },
      }),
      Tender.countDocuments({
        category: tender.category,
        lastSeenAt: { $gte: past30 },
        _id: { $ne: tender._id },
      }),
      Tender.countDocuments({
        district: tender.district,
        lastSeenAt: { $gte: past30 },
        _id: { $ne: tender._id },
      }),
    ]);

    const pressureScore = Math.min(100, Math.round(sameCategoryDistrictCount * 8 + recentCategoryCount * 2));
    const pressureLevel =
      pressureScore >= 75
        ? 'high'
        : pressureScore >= 45
          ? 'medium'
          : 'low';

    const estimatedCompetitors = Math.max(1, Math.round(sameCategoryDistrictCount * 1.6 + 2));

    return res.json({
      tenderId: tender._id,
      category: tender.category,
      district: tender.district,
      estimatedCompetitors,
      pressureScore,
      pressureLevel,
      marketSignals: {
        sameCategoryDistrictCount,
        sameDistrictCount,
        recentCategoryCount,
        recentDistrictCount,
      },
      recommendation:
        pressureLevel === 'high'
          ? 'Differentiate on technical quality and compliance speed.'
          : pressureLevel === 'medium'
            ? 'Competitive field is moderate. Tighten costing and responsiveness.'
            : 'Relatively open field. Prioritize complete submission and value clarity.',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load market snapshot.', error: error.message });
  }
};

const exportExecutiveBriefPdf = async (req, res) => {
  let browser;

  try {
    const tender = await Tender.findById(req.params.id);

    if (!tender) {
      return res.status(404).json({ message: 'Tender not found.' });
    }

    const payload = tender.toObject();
    const insight = buildMatchInsights(payload, req.user);
    const checklist = getChecklistForCategory(payload.category);
    const summary = insight.executiveSummary || '';

    const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Executive Brief</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }
      h1 { margin: 0 0 6px; font-size: 24px; }
      .muted { color: #475569; font-size: 12px; }
      .kpi-grid { margin-top: 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .kpi { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; }
      .kpi h3 { margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; }
      .kpi p { margin: 4px 0 0; font-size: 14px; font-weight: 700; }
      .section { margin-top: 16px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
      .section h2 { margin: 0 0 8px; font-size: 14px; }
      ul { margin: 6px 0 0 18px; padding: 0; }
      li { margin-bottom: 4px; font-size: 12px; }
      .small { font-size: 12px; }
      .decision-go { color: #047857; }
      .decision-hold { color: #b45309; }
      .decision-no-go { color: #be123c; }
      .footer { margin-top: 16px; color: #64748b; font-size: 11px; }
    </style>
  </head>
  <body>
    <h1>Avasar Patra Executive Tender Brief</h1>
    <p class="muted">Generated at: ${escapeHtml(new Date().toLocaleString())}</p>

    <div class="section">
      <h2>Tender Overview</h2>
      <p class="small"><strong>Title:</strong> ${escapeHtml(payload.title)}</p>
      <p class="small"><strong>Tender ID:</strong> ${escapeHtml(payload.tenderId)}</p>
      <p class="small"><strong>Procuring Entity:</strong> ${escapeHtml(payload.procuringEntity)}</p>
      <p class="small"><strong>Category:</strong> ${escapeHtml(payload.category)}</p>
      <p class="small"><strong>District:</strong> ${escapeHtml(payload.district)}</p>
      <p class="small"><strong>Amount:</strong> ${escapeHtml(formatNpr(payload.amount))}</p>
      <p class="small"><strong>Deadline:</strong> ${escapeHtml(payload.deadlineRaw || 'Refer official notice')}</p>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><h3>Match Score</h3><p>${escapeHtml(insight.matchPercent)}%</p></div>
      <div class="kpi"><h3>Decision</h3><p class="decision-${escapeHtml(insight.recommendation.decision)}">${escapeHtml(insight.recommendation.label)}</p></div>
      <div class="kpi"><h3>Confidence</h3><p>${escapeHtml(insight.recommendation.confidence)}%</p></div>
      <div class="kpi"><h3>Doc Readiness</h3><p>${escapeHtml(insight.documentGap.readyPercent)}%</p></div>
    </div>

    <div class="section">
      <h2>Executive Summary</h2>
      <p class="small">${escapeHtml(summary)}</p>
      <p class="small"><strong>Decision Reason:</strong> ${escapeHtml(insight.recommendation.reason)}</p>
      <p class="small"><strong>Deadline Risk:</strong> ${escapeHtml(insight.deadlineRisk.label)} (${escapeHtml(insight.deadlineRisk.daysLeft ?? 'Unknown')} day(s) left)</p>
      <p class="small"><strong>Recommended Action:</strong> ${escapeHtml(insight.deadlineRisk.recommendation)}</p>
    </div>

    <div class="section">
      <h2>Top Fit Factors</h2>
      <ul>
        ${insight.topReasons
          .map(
            (item) =>
              `<li><strong>${escapeHtml(item.title)} (${escapeHtml(item.score)}/${escapeHtml(item.max)}):</strong> ${escapeHtml(item.detail)}</li>`
          )
          .join('')}
      </ul>
    </div>

    <div class="section">
      <h2>Document Gap Assistant</h2>
      <p class="small"><strong>Missing:</strong> ${escapeHtml(insight.documentGap.missing.join(', ') || 'None')}</p>
      <p class="small"><strong>Expired:</strong> ${escapeHtml(insight.documentGap.expired.join(', ') || 'None')}</p>
      <p class="small"><strong>Expiring Soon:</strong> ${escapeHtml(insight.documentGap.expiringSoon.join(', ') || 'None')}</p>
    </div>

    <div class="section">
      <h2>Submission Checklist</h2>
      <ul>${checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </div>

    <p class="footer">Prepared by Avasar Patra Intelligence.</p>
  </body>
</html>
`;

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '10mm', bottom: '16mm', left: '10mm' },
    });

    const filename = `${toSafeFilename(payload.tenderId || payload.title)}-executive-brief.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate executive brief PDF.', error: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  listTenders,
  getTenderById,
  getMarketSnapshot,
  exportExecutiveBriefPdf,
};
