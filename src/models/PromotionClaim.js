import mongoose from 'mongoose';

const promotionClaimSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      required: true,
      index: true,
    },
    /** Dedup key, e.g. join | upgrade:<vipId> | birthday:2026 */
    claimKey: {
      type: String,
      required: true,
      trim: true,
    },
    userCoupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserCoupon',
      default: null,
    },
  },
  { timestamps: true, versionKey: false, collection: 'promotionClaims' }
);

promotionClaimSchema.index({ user: 1, claimKey: 1 }, { unique: true });

export default mongoose.model('PromotionClaim', promotionClaimSchema);
