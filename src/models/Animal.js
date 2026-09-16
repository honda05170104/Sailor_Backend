import mongoose from 'mongoose';

const animalSchema = new mongoose.Schema(
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
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnimalCategory',
      required: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    sort: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, versionKey: false }
);

animalSchema.index({ category: 1, name: 1 }, { unique: true });

animalSchema.methods.toSafeJSON = function toSafeJSON() {
  const category = this.category;
  const categoryJSON =
    category && typeof category === 'object' && typeof category.toSafeJSON === 'function'
      ? category.toSafeJSON()
      : category && typeof category === 'object' && category.name != null
        ? {
            id: category._id,
            name: category.name,
            enabled: category.enabled !== false,
          }
        : null;

  return {
    id: this._id,
    name: this.name,
    description: this.description || '',
    categoryId: categoryJSON?.id || category || null,
    category: categoryJSON,
    enabled: this.enabled !== false,
    sort: this.sort || 0,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Animal', animalSchema);
