const User = require('../models/User');

const parseAsBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return true;
};

const joinTenderJv = async (req, res) => {
  try {
    const { tenderId, enabled } = req.body;

    if (!tenderId) {
      return res.status(400).json({ message: 'tenderId is required.' });
    }

    const shouldEnable = parseAsBoolean(enabled);

    const update = shouldEnable
      ? { $addToSet: { activeJVBids: tenderId } }
      : { $pull: { activeJVBids: tenderId } };

    const user = await User.findByIdAndUpdate(req.user._id, update, {
      new: true,
      runValidators: true,
    }).select('activeJVBids');

    return res.json({
      message: shouldEnable ? 'JV participation enabled for this tender.' : 'JV participation disabled for this tender.',
      activeJVBids: user?.activeJVBids || [],
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update JV participation.', error: error.message });
  }
};

const getTenderJvPartners = async (req, res) => {
  try {
    const { tenderId } = req.params;

    if (!tenderId) {
      return res.status(400).json({ message: 'tenderId is required.' });
    }

    const users = await User.find({
      role: 'user',
      activeJVBids: tenderId,
      _id: { $ne: req.user._id },
    })
      .select('name category district capacity expertiseTags organizationType')
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    return res.json({
      tenderId,
      partners: users,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load JV partners.', error: error.message });
  }
};

module.exports = {
  joinTenderJv,
  getTenderJvPartners,
};
