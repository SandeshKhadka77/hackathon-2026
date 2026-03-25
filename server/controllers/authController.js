const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const TOKEN_TTL = '7d';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isDbReady = () => User.db?.readyState === 1;

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const normalizeString = (value = '') => String(value || '').trim();

const validatePassword = (password = '') => {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include uppercase, lowercase and number.';
  }

  return null;
};

const createToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET || 'dev-secret-change-me',
    { expiresIn: TOKEN_TTL }
  );

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  district: user.district,
  category: user.category,
  vendorGroup: user.vendorGroup,
  organizationType: user.organizationType,
  capacity: user.capacity,
  expertiseTags: user.expertiseTags || [],
  role: user.role,
  documents: user.documents || {},
  activeJVBids: user.activeJVBids || [],
  notificationPreferences: user.notificationPreferences || {},
  bookmarks: user.bookmarks || [],
});

const register = async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database is not ready. Please try again.' });
    }

    const {
      name,
      email,
      password,
      district,
      category,
      capacity,
      vendorGroup,
      organizationType,
      expertiseTags,
    } = req.body;

    const normalizedName = normalizeString(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedDistrict = normalizeString(district);
    const normalizedCategory = normalizeString(category);
    const numericCapacity = Number(capacity);

    if (!normalizedName || !normalizedEmail || !password || !normalizedDistrict || !normalizedCategory || capacity == null) {
      return res.status(400).json({ message: 'Missing required registration fields.' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Provide a valid email address.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    if (Number.isNaN(numericCapacity) || numericCapacity < 0) {
      return res.status(400).json({ message: 'Capacity must be a non-negative number.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      district: normalizedDistrict,
      category: normalizedCategory,
      vendorGroup: vendorGroup || 'Small',
      organizationType: organizationType || 'Other',
      capacity: numericCapacity,
      expertiseTags: Array.isArray(expertiseTags) ? expertiseTags : [],
      notificationPreferences: {
        emailEnabled: true,
        inAppEnabled: true,
        quickMatchAlerts: true,
        digestEnabled: true,
        digestHour: 8,
        maxAlertsPerRun: 8,
        minimumMatchPercent: 60,
      },
    });

    const token = createToken(user);
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    return res.status(500).json({ message: 'Failed to register user.', error: error.message });
  }
};

const registerOrganization = async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database is not ready. Please try again.' });
    }

    const { name, email, password, district, organizationType } = req.body;

    const normalizedName = normalizeString(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedDistrict = normalizeString(district || 'Kathmandu');

    if (!normalizedName || !normalizedEmail || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Provide a valid email address.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      district: normalizedDistrict,
      category: 'Other',
      vendorGroup: 'Medium',
      organizationType: organizationType || 'Private Limited',
      capacity: 0,
      expertiseTags: [],
      role: 'organization',
      notificationPreferences: {
        emailEnabled: true,
        inAppEnabled: true,
        quickMatchAlerts: false,
        digestEnabled: false,
        digestHour: 8,
        maxAlertsPerRun: 8,
        minimumMatchPercent: 60,
      },
    });

    const token = createToken(user);
    return res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    return res.status(500).json({ message: 'Failed to register organization.', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    if (!isDbReady()) {
      return res.status(503).json({ message: 'Database is not ready. Please try again.' });
    }

    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Provide a valid email address.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = createToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to login.', error: error.message });
  }
};

const me = async (req, res) => {
  return res.json({ user: req.user });
};

module.exports = {
  register,
  registerOrganization,
  login,
  me,
};
