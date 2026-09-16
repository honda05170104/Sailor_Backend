import mongoose from 'mongoose';

const animalCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
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
  { timestamps: true, versionKey: false, collection: 'animalsCategory' }
);

animalCategorySchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    description: this.description || '',
    enabled: this.enabled !== false,
    sort: this.sort || 0,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('AnimalCategory', animalCategorySchema);
