import mongoose from 'mongoose';

const MOUSE_ORDER_WEEK_STATUSES = ['open', 'submitted'];

const snapshotItemSchema = new mongoose.Schema(
  {
    form: { type: String, required: true },
    size: { type: String, required: true },
    spec: { type: String, required: true },
    ageDays: { type: Number, default: null },
    packs: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const mouseOrderWeekSchema = new mongoose.Schema(
  {
    weekOf: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    deadlineAt: {
      type: Date,
      required: true,
    },
    arrivesAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: MOUSE_ORDER_WEEK_STATUSES,
      default: 'open',
      index: true,
    },
    snapshot: {
      type: [snapshotItemSchema],
      default: [],
    },
    summarizedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Manager',
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

mouseOrderWeekSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    weekOf: this.weekOf,
    deadlineAt: this.deadlineAt,
    arrivesAt: this.arrivesAt,
    status: this.status || 'open',
    snapshot: (this.snapshot || []).map((item) => ({
      form: item.form,
      size: item.size,
      spec: item.spec,
      ageDays: item.ageDays ?? null,
      packs: item.packs,
    })),
    summarizedAt: this.summarizedAt || null,
    submittedAt: this.submittedAt || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export { MOUSE_ORDER_WEEK_STATUSES };
export default mongoose.model('MouseOrderWeek', mouseOrderWeekSchema);
