const Notification = require('../models/Notification');
const User = require('../models/User');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const listNotifications = async (req, res) => {
  try {
    const items = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('tender');

    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch notifications.', error: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    return res.json({ item: updated });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update notification.', error: error.message });
  }
};

const getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences');
    return res.json({ preferences: user?.notificationPreferences || {} });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load preferences.', error: error.message });
  }
};

const updatePreferences = async (req, res) => {
  try {
    const updates = req.body || {};
    const user = await User.findById(req.user._id);

    user.notificationPreferences = {
      ...(user.notificationPreferences?.toObject?.() || user.notificationPreferences || {}),
      ...updates,
    };

    if (user.notificationPreferences.minimumMatchPercent != null) {
      const next = Number(user.notificationPreferences.minimumMatchPercent);
      user.notificationPreferences.minimumMatchPercent = Number.isNaN(next)
        ? 60
        : clamp(next, 30, 100);
    }

    if (user.notificationPreferences.digestHour != null) {
      const next = Number(user.notificationPreferences.digestHour);
      user.notificationPreferences.digestHour = Number.isNaN(next) ? 8 : clamp(next, 0, 23);
    }

    if (user.notificationPreferences.maxAlertsPerRun != null) {
      const next = Number(user.notificationPreferences.maxAlertsPerRun);
      user.notificationPreferences.maxAlertsPerRun = Number.isNaN(next) ? 8 : clamp(next, 1, 30);
    }

    await user.save();

    return res.json({
      message: 'Notification preferences updated.',
      preferences: user.notificationPreferences,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update preferences.', error: error.message });
  }
};

module.exports = {
  listNotifications,
  markAsRead,
  getPreferences,
  updatePreferences,
};
