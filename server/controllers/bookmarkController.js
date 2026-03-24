const User = require('../models/User');

const listBookmarks = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('bookmarks');
    return res.json({ items: user?.bookmarks || [] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bookmarks.', error: error.message });
  }
};

const toggleBookmark = async (req, res) => {
  try {
    const { tenderId } = req.body;

    if (!tenderId) {
      return res.status(400).json({ message: 'tenderId is required.' });
    }

    const user = await User.findById(req.user._id);
    const alreadyBookmarked = user.bookmarks.some((id) => id.toString() === tenderId);

    if (alreadyBookmarked) {
      user.bookmarks = user.bookmarks.filter((id) => id.toString() !== tenderId);
    } else {
      user.bookmarks.push(tenderId);
    }

    await user.save();
    return res.json({
      bookmarked: !alreadyBookmarked,
      bookmarks: user.bookmarks,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update bookmark.', error: error.message });
  }
};

module.exports = {
  listBookmarks,
  toggleBookmark,
};
