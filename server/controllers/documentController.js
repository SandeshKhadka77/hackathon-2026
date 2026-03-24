const User = require('../models/User');

const ALLOWED_DOC_TYPES = {
  panVat: 'PAN/VAT',
  taxClearance: 'Tax Clearance',
  companyRegistration: 'Company Registration',
};

const daysUntil = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue).getTime();
  if (Number.isNaN(date)) {
    return null;
  }

  return Math.ceil((date - Date.now()) / (1000 * 60 * 60 * 24));
};

const uploadDocument = async (req, res) => {
  try {
    const { docType } = req.body;

    if (!docType || !ALLOWED_DOC_TYPES[docType]) {
      return res.status(400).json({ message: 'Invalid document type.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const user = await User.findById(req.user._id);
    user.documents = user.documents || {};
    user.documents[docType] = {
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
      expiresAt: req.body.expiresAt || null,
      reminderSentAt: null,
    };

    await user.save();

    return res.status(201).json({
      message: `${ALLOWED_DOC_TYPES[docType]} uploaded successfully.`,
      documents: user.documents,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upload document.', error: error.message });
  }
};

const getDocuments = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('documents');
    const documents = user?.documents || {};

    const expiry = Object.entries(documents).reduce((acc, [key, value]) => {
      const expiresInDays = daysUntil(value?.expiresAt);
      acc[key] = {
        expiresAt: value?.expiresAt || null,
        expiresInDays,
        isExpired: expiresInDays != null ? expiresInDays < 0 : false,
        isExpiringSoon: expiresInDays != null ? expiresInDays >= 0 && expiresInDays <= 30 : false,
      };
      return acc;
    }, {});

    return res.json({ documents, expiry });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load documents.', error: error.message });
  }
};

const updateDocumentExpiry = async (req, res) => {
  try {
    const { docType, expiresAt } = req.body;

    if (!docType || !ALLOWED_DOC_TYPES[docType]) {
      return res.status(400).json({ message: 'Invalid document type.' });
    }

    const user = await User.findById(req.user._id);
    const existing = user.documents?.[docType];

    if (!existing) {
      return res.status(404).json({ message: 'Document not uploaded yet.' });
    }

    user.documents[docType] = {
      ...(existing.toObject ? existing.toObject() : existing),
      expiresAt: expiresAt || null,
      reminderSentAt: null,
    };

    await user.save();

    return res.json({
      message: `${ALLOWED_DOC_TYPES[docType]} expiry updated successfully.`,
      documents: user.documents,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update expiry.', error: error.message });
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  updateDocumentExpiry,
};
