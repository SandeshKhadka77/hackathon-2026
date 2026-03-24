const Tender = require('../models/Tender');
const { buildMatchInsights, getChecklistForCategory } = require('../utils/matching');

const getMatches = async (req, res) => {
  try {
    const user = req.user;

    const strictMatches = await Tender.find({
      district: user.district,
      category: user.category,
      amount: { $lte: user.capacity },
      isActive: true,
    }).sort({ deadlineAt: 1 });

    let matches = strictMatches;

    if (!matches.length) {
      matches = await Tender.find({
        district: user.district,
        category: user.category,
        isActive: true,
      }).sort({ deadlineAt: 1 });
    }

    const withScores = matches.map((item) => {
      const tender = item.toObject();
      const insight = buildMatchInsights(tender, user);

      return {
        ...tender,
        matchPercent: insight.matchPercent,
        checklist: getChecklistForCategory(tender.category),
        insight,
      };
    });

    return res.json({ items: withScores });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to match tenders.', error: error.message });
  }
};

module.exports = {
  getMatches,
};
