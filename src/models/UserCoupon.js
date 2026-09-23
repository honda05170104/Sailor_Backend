import mongoose from 'mongoose';
import {
  COUPON_TYPES,
  USER_COUPON_STATUSES,
  USER_COUPON_SOURCES,
  USER_COUPON_SOURCE_LABELS,
  effectiveCouponStatus,
} from '../services/coupons.js';

const userCouponSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
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
    status: {
      type: String,
      enum: USER_COUPON_STATUSES,
      default: 'available',
      index: true,
    },
    /** manual = admin issue | promotion = 優惠活動 auto issue */
    source: {
      type: String,
      enum: USER_COUPON_SOURCES,
      default: 'manual',
      index: true,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      default: null,
    },
    promotionName: {
      type: String,
      trim: true,
      default: '',
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false, collection: 'userCoupons' }
);

userCouponSchema.methods.toSafeJSON = function toSafeJSON() {
  const source = USER_COUPON_SOURCES.includes(this.source)
    ? this.source
    : 'manual';
  return {
    id: String(this._id),
    couponId: this.coupon ? String(this.coupon) : null,
    name: this.name,
    description: this.description || '',
    type: this.type,
    value: this.value,
    minSpend: this.minSpend || 0,
    status: effectiveCouponStatus(this),
    source,
    sourceLabel: USER_COUPON_SOURCE_LABELS[source] || source,
    promotionId: this.promotion ? String(this.promotion) : null,
    promotionName: this.promotionName || '',
    issuedAt: this.issuedAt || this.createdAt || null,
    expiresAt: this.expiresAt || null,
    usedAt: this.usedAt || null,
  };
};

export default mongoose.model('UserCoupon', userCouponSchema);
