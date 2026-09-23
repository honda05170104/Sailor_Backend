import mongoose from 'mongoose';

export const PROMOTION_TYPES = ['join', 'upgrade', 'birthday'];

const promotionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: PROMOTION_TYPES,
      required: true,
      index: true,
    },
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
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
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

promotionSchema.methods.toSafeJSON = function toSafeJSON() {
  const coupon =
    this.coupon && typeof this.coupon.toSafeJSON === 'function'
      ? this.coupon.toSafeJSON()
      : this.coupon
        ? { id: String(this.coupon) }
        : null;

  return {
    id: String(this._id),
    key: this.key,
    type: this.type,
    name: this.name,
    description: this.description || '',
    coupon,
    couponId: coupon?.id || (this.coupon ? String(this.coupon) : null),
    enabled: this.enabled !== false,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Promotion', promotionSchema);
