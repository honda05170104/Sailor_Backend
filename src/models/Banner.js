import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    linkUrl: {
      type: String,
      trim: true,
      default: '',
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

bannerSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    imageUrl: this.imageUrl,
    linkUrl: this.linkUrl || '',
    sortOrder: this.sortOrder ?? 0,
    enabled: this.enabled !== false,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Banner', bannerSchema);
