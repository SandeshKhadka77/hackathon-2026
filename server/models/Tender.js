const mongoose = require('mongoose');

const TenderDocumentLinkSchema = new mongoose.Schema(
  {
    label: { type: String, default: '', trim: true },
    url: { type: String, required: true, trim: true },
    type: { type: String, enum: ['pdf', 'detail', 'other'], default: 'other' },
  },
  { _id: false }
);

const TenderSchema = new mongoose.Schema(
  {
    tenderId: { type: String, required: true, unique: true, index: true, trim: true },
    title: { type: String, required: true, trim: true },
    procuringEntity: { type: String, default: '', trim: true },
    category: {
      type: String,
      enum: ['Works', 'Goods', 'Consulting', 'Other'],
      default: 'Other',
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['ppmo', 'private'],
      default: 'ppmo',
      index: true,
    },
    organizationName: { type: String, default: '', trim: true },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    location: { type: String, default: '', trim: true },
    district: { type: String, default: 'Unknown', index: true },
    amount: { type: Number, default: 0, min: 0 },
    requiredDocuments: { type: [String], default: [] },
    contactEmail: { type: String, default: '', trim: true },
    contactPhone: { type: String, default: '', trim: true },
    deadlineRaw: { type: String, default: '' },
    deadlineAt: { type: Date, index: true },
    detailUrl: { type: String, default: '' },
    noticeUrl: { type: String, default: '' },
    documentLinks: { type: [TenderDocumentLinkSchema], default: [] },
    sourceUrl: { type: String, default: '' },
    sourceFingerprint: { type: String, default: '', index: true },
    scrapeRunId: { type: String, default: '', index: true },
    parseConfidence: { type: Number, default: 0, min: 0, max: 100 },
    sourcePage: { type: Number, default: 1, min: 1 },
    sourcePosition: { type: Number, default: 1, min: 1 },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    isActive: { type: Boolean, default: true, index: true },
    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TenderSchema.index({ title: 'text', procuringEntity: 'text', tenderId: 'text' });

module.exports = mongoose.model('Tender', TenderSchema);