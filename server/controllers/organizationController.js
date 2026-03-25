const Tender = require('../models/Tender');
const User = require('../models/User');

const parseAmount = (value) => {
  const parsed = Number(value || 0);
  return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
};

const parseDeadline = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return null;
  }

  const asDate = new Date(trimmed);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
};

const createTenderId = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORG-${stamp}-${suffix}`;
};

const listOrganizationTenders = async (req, res) => {
  try {
    const rows = await Tender.find({ sourceType: 'private', publishedBy: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    const items = await Promise.all(
      rows.map(async (item) => {
        const bookmarkCount = await User.countDocuments({ bookmarks: item._id });
        return {
          ...item.toObject(),
          analytics: {
            bookmarkCount,
          },
        };
      })
    );

    const totalValue = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const totalBookmarks = items.reduce((acc, item) => acc + Number(item.analytics?.bookmarkCount || 0), 0);
    const activeTenders = items.filter((item) => item.isActive).length;

    const summary = {
      totalTenders: items.length,
      activeTenders,
      totalValue,
      totalBookmarks,
    };

    return res.json({ items, summary });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load organization tenders.', error: error.message });
  }
};

const createOrganizationTender = async (req, res) => {
  try {
    const {
      title,
      category,
      district,
      location,
      amount,
      deadlineRaw,
      detailUrl,
      noticeUrl,
      requiredDocuments,
      contactEmail,
      contactPhone,
    } = req.body;

    if (!String(title || '').trim() || !String(category || '').trim() || !String(district || '').trim()) {
      return res.status(400).json({ message: 'Title, category and district are required.' });
    }

    const numericAmount = parseAmount(amount);
    if (numericAmount == null) {
      return res.status(400).json({ message: 'Amount must be a non-negative number.' });
    }

    const deadlineAt = parseDeadline(deadlineRaw);
    if (!deadlineAt) {
      return res.status(400).json({ message: 'Provide a valid deadline date/time.' });
    }

    const tender = await Tender.create({
      tenderId: createTenderId(),
      title: String(title).trim(),
      procuringEntity: String(req.user.name || '').trim() || 'Private Organization',
      category,
      sourceType: 'private',
      organizationName: String(req.user.name || '').trim(),
      publishedBy: req.user._id,
      location: String(location || '').trim(),
      district: String(district || '').trim(),
      amount: numericAmount,
      requiredDocuments: Array.isArray(requiredDocuments)
        ? requiredDocuments.map((item) => String(item).trim()).filter(Boolean)
        : [],
      contactEmail: String(contactEmail || req.user.email || '').trim(),
      contactPhone: String(contactPhone || '').trim(),
      deadlineRaw: String(deadlineRaw || '').trim(),
      deadlineAt,
      detailUrl: String(detailUrl || '').trim(),
      noticeUrl: String(noticeUrl || '').trim(),
      sourceUrl: String(detailUrl || '').trim() || 'private-portal',
      sourceFingerprint: `private-${req.user._id}-${Date.now()}`,
      scrapeRunId: 'private-portal',
      parseConfidence: 100,
      sourcePage: 1,
      sourcePosition: 1,
      isActive: true,
      lastSeenAt: new Date(),
      scrapedAt: new Date(),
    });

    return res.status(201).json({ item: tender, message: 'Private tender published successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to publish private tender.', error: error.message });
  }
};

const updateOrganizationTender = async (req, res) => {
  try {
    const tender = await Tender.findOne({
      _id: req.params.id,
      sourceType: 'private',
      publishedBy: req.user._id,
    });

    if (!tender) {
      return res.status(404).json({ message: 'Private tender not found.' });
    }

    const updates = {};
    const keys = ['title', 'category', 'district', 'location', 'detailUrl', 'noticeUrl', 'contactEmail', 'contactPhone', 'deadlineRaw'];

    keys.forEach((key) => {
      if (req.body[key] != null) {
        updates[key] = String(req.body[key]).trim();
      }
    });

    if (req.body.amount != null) {
      const numericAmount = parseAmount(req.body.amount);
      if (numericAmount == null) {
        return res.status(400).json({ message: 'Amount must be a non-negative number.' });
      }
      updates.amount = numericAmount;
    }

    if (req.body.deadlineRaw != null) {
      const deadlineAt = parseDeadline(req.body.deadlineRaw);
      if (!deadlineAt) {
        return res.status(400).json({ message: 'Provide a valid deadline date/time.' });
      }
      updates.deadlineAt = deadlineAt;
    }

    if (req.body.requiredDocuments != null) {
      updates.requiredDocuments = Array.isArray(req.body.requiredDocuments)
        ? req.body.requiredDocuments.map((item) => String(item).trim()).filter(Boolean)
        : [];
    }

    if (req.body.isActive != null) {
      updates.isActive = Boolean(req.body.isActive);
    }

    const updated = await Tender.findByIdAndUpdate(tender._id, { $set: updates }, { new: true });
    return res.json({ item: updated, message: 'Private tender updated.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update private tender.', error: error.message });
  }
};

module.exports = {
  listOrganizationTenders,
  createOrganizationTender,
  updateOrganizationTender,
};
