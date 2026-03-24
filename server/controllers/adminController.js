const User = require('../models/User');
const Tender = require('../models/Tender');
const Notification = require('../models/Notification');
const VendorPipeline = require('../models/VendorPipeline');
const { runScraperAndUpsert, sendDailyDigests } = require('../utils/scraper');

const getWindowStart = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
};

const toDateKey = (date) => {
  return new Date(date).toISOString().slice(0, 10);
};

const buildDateSeries = (days) => {
  const start = getWindowStart(days);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toDateKey(date);
  });
};

const buildLookup = (rows = []) => {
  return rows.reduce((acc, item) => {
    acc[item._id] = item;
    return acc;
  }, {});
};

const buildTrendFilter = ({ category, vendorGroup }) => {
  const filters = {};

  if (category && category !== 'all') {
    filters['tenderDoc.category'] = category;
  }

  if (vendorGroup && vendorGroup !== 'all') {
    filters['userDoc.vendorGroup'] = vendorGroup;
  }

  return filters;
};

const getDashboardStats = async (_req, res) => {
  try {
    const [
      userCount,
      tenderCount,
      activeTenderCount,
      deadline24hCount,
      deadline7dCount,
      notification24hCount,
      emailed24hCount,
      latestTender,
      categoryBreakdown,
      pipelineOutcomeBreakdown,
      parseStats,
      avgAlertScoreStats,
    ] = await Promise.all([
      User.countDocuments(),
      Tender.countDocuments(),
      Tender.countDocuments({ isActive: true }),
      Tender.countDocuments({
        isActive: true,
        deadlineAt: { $gte: new Date(), $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      }),
      Tender.countDocuments({
        isActive: true,
        deadlineAt: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      }),
      Notification.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      Notification.countDocuments({
        emailedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        emailStatus: 'sent',
      }),
      Tender.findOne().sort({ scrapedAt: -1 }).select('scrapeRunId scrapedAt totalProcessed avgParseConfidence'),
      Tender.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      VendorPipeline.aggregate([
        { $group: { _id: '$outcome.result', count: { $sum: 1 } } },
      ]),
      Tender.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            avgParseConfidence: { $avg: '$parseConfidence' },
          },
        },
      ]),
      Notification.aggregate([
        { $match: { type: 'match', createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: null,
            avgAlertScore: { $avg: '$metadata.alertScore' },
          },
        },
      ]),
    ]);

    const outcomes = pipelineOutcomeBreakdown.reduce(
      (acc, item) => ({ ...acc, [item._id || 'pending']: item.count }),
      { won: 0, lost: 0, withdrawn: 0, pending: 0 }
    );
    const decided = (outcomes.won || 0) + (outcomes.lost || 0) + (outcomes.withdrawn || 0);
    const winRate = decided > 0 ? Math.round(((outcomes.won || 0) / decided) * 100) : 0;

    const topLossReasons = await VendorPipeline.aggregate([
      {
        $match: {
          'outcome.result': { $in: ['lost', 'withdrawn'] },
          'outcome.reason': { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: { $toLower: '$outcome.reason' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    return res.json({
      userCount,
      tenderCount,
      activeTenderCount,
      urgency: {
        deadline24hCount,
        deadline7dCount,
      },
      notifications: {
        notification24hCount,
        emailed24hCount,
      },
      scraper: {
        latestRunId: latestTender?.scrapeRunId || null,
        latestScrapedAt: latestTender?.scrapedAt || null,
        avgParseConfidence: Math.round(parseStats?.[0]?.avgParseConfidence || 0),
      },
      intelligence: {
        winRate,
        outcomes,
        topLossReasons: topLossReasons.map((item) => ({ reason: item._id, count: item.count })),
        avgAlertScore: Math.round(avgAlertScoreStats?.[0]?.avgAlertScore || 0),
      },
      categoryBreakdown: categoryBreakdown.map((item) => ({ category: item._id || 'Other', count: item.count })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load admin stats.', error: error.message });
  }
};

const runScraper = async (_req, res) => {
  try {
    const result = await runScraperAndUpsert();
    return res.json({
      message: 'Scraper run completed.',
      ...result,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to run scraper.', error: error.message });
  }
};

const sendDigestBatch = async (_req, res) => {
  try {
    const result = await sendDailyDigests({ force: true });
    return res.json({
      message: 'Digest batch run completed.',
      ...result,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send digest batch.', error: error.message });
  }
};

const getTrendStats = async (req, res) => {
  try {
    const days = Math.max(7, Math.min(30, Number(req.query.days || 14)));
    const start = getWindowStart(days);
    const dateSeries = buildDateSeries(days);
    const trendFilters = buildTrendFilter(req.query || {});
    const hasFilters = Object.keys(trendFilters).length > 0;

    const [notificationTrend, outcomeTrend] = await Promise.all([
      Notification.aggregate([
        {
          $match: {
            createdAt: { $gte: start },
            type: 'match',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDoc',
          },
        },
        { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'tenders',
            localField: 'tender',
            foreignField: '_id',
            as: 'tenderDoc',
          },
        },
        { $unwind: { path: '$tenderDoc', preserveNullAndEmptyArrays: true } },
        ...(hasFilters ? [{ $match: trendFilters }] : []),
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            totalNotifications: { $sum: 1 },
            avgAlertScore: { $avg: '$metadata.alertScore' },
            emailedCount: {
              $sum: {
                $cond: [{ $eq: ['$emailStatus', 'sent'] }, 1, 0],
              },
            },
          },
        },
      ]),
      VendorPipeline.aggregate([
        {
          $match: {
            'outcome.recordedAt': { $gte: start },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDoc',
          },
        },
        { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'tenders',
            localField: 'tender',
            foreignField: '_id',
            as: 'tenderDoc',
          },
        },
        { $unwind: { path: '$tenderDoc', preserveNullAndEmptyArrays: true } },
        ...(hasFilters ? [{ $match: trendFilters }] : []),
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$outcome.recordedAt' } },
            won: {
              $sum: {
                $cond: [{ $eq: ['$outcome.result', 'won'] }, 1, 0],
              },
            },
            lost: {
              $sum: {
                $cond: [{ $eq: ['$outcome.result', 'lost'] }, 1, 0],
              },
            },
            withdrawn: {
              $sum: {
                $cond: [{ $eq: ['$outcome.result', 'withdrawn'] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const notificationLookup = buildLookup(notificationTrend);
    const outcomeLookup = buildLookup(outcomeTrend);

    const points = dateSeries.map((dateKey) => {
      const notify = notificationLookup[dateKey] || {};
      const outcomes = outcomeLookup[dateKey] || {};
      const decided = Number(outcomes.won || 0) + Number(outcomes.lost || 0) + Number(outcomes.withdrawn || 0);

      return {
        date: dateKey,
        notifications: Number(notify.totalNotifications || 0),
        emailed: Number(notify.emailedCount || 0),
        avgAlertScore: Math.round(Number(notify.avgAlertScore || 0)),
        wins: Number(outcomes.won || 0),
        decided,
        winRate: decided > 0 ? Math.round((Number(outcomes.won || 0) / decided) * 100) : 0,
      };
    });

    return res.json({
      days,
      filters: {
        category: req.query.category || 'all',
        vendorGroup: req.query.vendorGroup || 'all',
      },
      points,
      summary: {
        totalNotifications: points.reduce((acc, item) => acc + item.notifications, 0),
        totalEmailed: points.reduce((acc, item) => acc + item.emailed, 0),
        averageAlertScore: points.length
          ? Math.round(points.reduce((acc, item) => acc + item.avgAlertScore, 0) / points.length)
          : 0,
        averageWinRate: points.length
          ? Math.round(points.reduce((acc, item) => acc + item.winRate, 0) / points.length)
          : 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load admin trends.', error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  runScraper,
  sendDigestBatch,
  getTrendStats,
};
