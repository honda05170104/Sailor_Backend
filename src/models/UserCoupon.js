import mongoose from 'mongoose';
import { COUPON_TYPES, USER_COUPON_STATUSES, effectiveCouponStatus } from '../utils/coupons.js';

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
  return {
    id: String(this._id),
    couponId: this.coupon ? String(this.coupon) : null,
    name: this.name,
    description: this.description || '',
    type: this.type,
    value: this.value,
    minSpend: this.minSpend || 0,
    status: effectiveCouponStatus(this),
    issuedAt: this.issuedAt || this.createdAt || null,
    expiresAt: this.expiresAt || null,
    usedAt: this.usedAt || null,
  };
};

export default mongoose.model('UserCoupon', userCouponSchema);
