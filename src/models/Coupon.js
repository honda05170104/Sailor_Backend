import mongoose from 'mongoose';
import {
  COUPON_TYPES,
  COUPON_EXPIRY_MODES,
  COUPON_CATEGORIES,
  normalizeExpiryMode,
  normalizeCouponCategory,
} from '../services/coupons.js';

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
    /** general | upgrade | birthday — for admin filters (入會禮歸升等禮) */
    category: {
      type: String,
      enum: COUPON_CATEGORIES,
      default: 'general',
      index: true,
    },
    /** fixed: startsAt + endsAt | relative: expireDays after issue */
    expiryMode: {
      type: String,
      enum: COUPON_EXPIRY_MODES,
      default: 'fixed',
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    expireDays: {
      type: Number,
      default: null,
      min: 1,
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
  const expiryMode = normalizeExpiryMode(this);
  return {
    id: this._id,
    name: this.name,
    description: this.description || '',
    type: this.type,
    value: this.value,
    minSpend: this.minSpend || 0,
    category: normalizeCouponCategory(this.category),
    expiryMode,
    startsAt: expiryMode === 'fixed' ? this.startsAt || null : null,
    endsAt: expiryMode === 'fixed' ? this.endsAt || null : null,
    expireDays: expiryMode === 'relative' ? this.expireDays || null : null,
    enabled: this.enabled !== false,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Coupon', couponSchema);
