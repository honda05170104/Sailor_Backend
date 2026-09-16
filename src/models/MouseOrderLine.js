import mongoose from 'mongoose';
import { MOUSE_FORMS, MOUSE_SIZES, MOUSE_SPECS } from '../constants/mice.js';

const mouseOrderLineSchema = new mongoose.Schema(
  {
    weekOf: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    form: {
      type: String,
      enum: MOUSE_FORMS,
      required: true,
    },
    size: {
      type: String,
      enum: MOUSE_SIZES,
      required: true,
    },
    spec: {
      type: String,
      enum: MOUSE_SPECS,
      required: true,
    },
    ageDays: {
      type: Number,
      default: null,
      min: 1,
    },
    packs: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { timestamps: true, versionKey: false }
);

mouseOrderLineSchema.index(
  { weekOf: 1, user: 1, form: 1, size: 1, spec: 1, ageDays: 1 },
  { unique: true }
);

function presentUser(user) {
  if (!user) return null;
  if (typeof user !== 'object') return { id: user };

  return {
    id: user._id || user.id,
    displayName: user.displayName || '',
    mobile: user.mobile || '',
  };
}

mouseOrderLineSchema.methods.toSafeJSON = function toSafeJSON() {
  const user = presentUser(this.user);

  return {
    id: this._id,
    weekOf: this.weekOf,
    userId: user?.id || this.user || null,
    user,
    form: this.form,
    size: this.size,
    spec: this.spec,
    ageDays: this.ageDays ?? null,
    packs: this.packs,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('MouseOrderLine', mouseOrderLineSchema);
