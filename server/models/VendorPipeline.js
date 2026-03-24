const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema(
  {
    memberName: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    task: { type: String, required: true, trim: true },
    dueAt: { type: Date, default: null },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const EstimateSchema = new mongoose.Schema(
  {
    emdAmount: { type: Number, default: 0, min: 0 },
    documentCost: { type: Number, default: 0, min: 0 },
    logisticsCost: { type: Number, default: 0, min: 0 },
    laborCost: { type: Number, default: 0, min: 0 },
    contingencyCost: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const OutcomeSchema = new mongoose.Schema(
  {
    result: {
      type: String,
      enum: ['won', 'lost', 'withdrawn', 'pending'],
      default: 'pending',
    },
    reason: { type: String, default: '', trim: true },
    learning: { type: String, default: '', trim: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VendorPipelineSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tender: { type: mongoose.Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    status: {
      type: String,
      enum: ['watching', 'preparing', 'submitted', 'won', 'lost'],
      default: 'watching',
      index: true,
    },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    estimate: { type: EstimateSchema, default: () => ({}) },
    assignments: { type: [AssignmentSchema], default: [] },
    outcome: { type: OutcomeSchema, default: () => ({}) },
  },
  { timestamps: true }
);

VendorPipelineSchema.index({ user: 1, tender: 1 }, { unique: true });

module.exports = mongoose.model('VendorPipeline', VendorPipelineSchema);
