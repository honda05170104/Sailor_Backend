import mongoose from 'mongoose';

const speciesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Species',
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

speciesSchema.index({ parent: 1, name: 1 }, { unique: true });
speciesSchema.index({ parent: 1, sortOrder: 1, name: 1 });

speciesSchema.methods.toSafeJSON = function toSafeJSON() {
  const parent = this.parent;
  const parentDoc =
    parent && typeof parent === 'object' && parent._id ? parent : null;

  return {
    id: this._id,
    name: this.name,
    parentId: parentDoc ? parentDoc._id : parent || null,
    parentName: parentDoc?.name || '',
    sortOrder: this.sortOrder ?? 0,
    enabled: this.enabled !== false,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Species', speciesSchema);
