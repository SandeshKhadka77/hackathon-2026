const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tender: { type: mongoose.Schema.Types.ObjectId, ref: 'Tender', required: true },
    title: { type: String, required: true },
    reason: { type: String, required: true },
    type: { type: String, enum: ['match', 'document-expiry', 'system'], default: 'match' },
    channels: {
      type: [String],
      enum: ['in_app', 'email'],
      default: ['in_app'],
    },
    emailStatus: { type: String, enum: ['skipped', 'pending', 'sent', 'failed'], default: 'skipped' },
    emailedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, tender: 1 }, { unique: true });

module.exports = mongoose.model('Notification', NotificationSchema);
