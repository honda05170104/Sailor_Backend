import mongoose from 'mongoose';

const vipSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    rank: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    minSpend: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true, versionKey: false }
);

vipSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    rank: this.rank,
    minSpend: this.minSpend,
    discountPercent: this.discountPercent,
    description: this.description || '',
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Vip', vipSchema);
