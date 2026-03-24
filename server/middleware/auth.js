const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getTokenFromHeader = (headerValue = '') => {
  if (!headerValue || !headerValue.startsWith('Bearer ')) {
    return null;
  }

  return headerValue.slice(7);
};

const requireAuth = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    const user = await User.findById(payload.sub).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed.' });
  }
};

const requireRole = (roles = []) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have access to this resource.' });
  }

  return next();
};

module.exports = {
  requireAuth,
  requireRole,
};
