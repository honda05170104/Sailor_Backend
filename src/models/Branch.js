import mongoose from 'mongoose';

const BRANCH_TYPES = ['Directly', 'Corporate', 'Department'];

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: BRANCH_TYPES,
      required: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

branchSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    type: this.type,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export { BRANCH_TYPES };
export default mongoose.model('Branch', branchSchema);
