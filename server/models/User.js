const mongoose = require('mongoose');

const UploadedDocumentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    reminderSentAt: { type: Date, default: null },
  },
  { _id: false }
);

const NotificationPreferenceSchema = new mongoose.Schema(
  {
    emailEnabled: { type: Boolean, default: true },
    inAppEnabled: { type: Boolean, default: true },
    quickMatchAlerts: { type: Boolean, default: true },
    digestEnabled: { type: Boolean, default: true },
    digestHour: { type: Number, default: 8, min: 0, max: 23 },
    maxAlertsPerRun: { type: Number, default: 8, min: 1, max: 30 },
    minimumMatchPercent: { type: Number, default: 60, min: 30, max: 100 },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    district: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['Works', 'Goods', 'Consulting', 'Other'],
    },
    vendorGroup: {
      type: String,
      enum: ['Small', 'Medium', 'Large', 'Consortium'],
      default: 'Small',
      index: true,
    },
    organizationType: {
      type: String,
      enum: ['Sole Proprietor', 'Private Limited', 'Partnership', 'Cooperative', 'NGO/INGO', 'Other'],
      default: 'Other',
    },
    capacity: { type: Number, required: true, min: 0 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    expertiseTags: [{ type: String, trim: true }],
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tender' }],
    documents: {
      panVat: UploadedDocumentSchema,
      taxClearance: UploadedDocumentSchema,
      companyRegistration: UploadedDocumentSchema,
    },
    notificationPreferences: { type: NotificationPreferenceSchema, default: () => ({}) },
    notificationLastCheckedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
