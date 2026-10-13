import mongoose from 'mongoose';

const speciesReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    species: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Species',
      default: null,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Species',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

speciesReviewSchema.index({ status: 1, createdAt: -1 });
speciesReviewSchema.index({ user: 1, status: 1, name: 1 });

speciesReviewSchema.methods.toSafeJSON = function toSafeJSON() {
  const user = this.user && typeof this.user === 'object' && this.user._id ? this.user : null;

  return {
    id: this._id,
    name: this.name,
    status: this.status,
    userId: user ? user._id : this.user || null,
    displayName: user?.displayName || '',
    mobile: user?.mobile || '',
    speciesId: this.species || null,
    parentId: this.parent || null,
    createdAt: this.createdAt,
    reviewedAt: this.reviewedAt || null,
  };
};

export default mongoose.model('SpeciesReview', speciesReviewSchema);
