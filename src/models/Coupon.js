import mongoose from 'mongoose';
import { COUPON_TYPES } from '../utils/coupons.js';

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: COUPON_TYPES,
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    minSpend: {
      type: Number,
      default: 0,
      min: 0,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

couponSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    description: this.description || '',
    type: this.type,
    value: this.value,
    minSpend: this.minSpend || 0,
    startsAt: this.startsAt || null,
    endsAt: this.endsAt || null,
    enabled: this.enabled !== false,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Coupon', couponSchema);
