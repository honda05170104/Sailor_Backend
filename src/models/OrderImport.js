import mongoose from 'mongoose';
import { getStoreById } from '../data/stores.js';

/** One staff import of a store's POS file for a single business day. */
const orderImportSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    /** Staff-selected POS business day (Asia/Taipei YYYY-MM-DD). */
    orderDate: {
      type: String,
      required: true,
      index: true,
    },
    totalOrders: { type: Number, default: 0, min: 0 },
    imported: { type: Number, default: 0, min: 0 },
    skippedNoMobile: { type: Number, default: 0, min: 0 },
    skippedDuplicate: { type: Number, default: 0, min: 0 },
    skippedVoided: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false }
);

orderImportSchema.index({ orderDate: -1, createdAt: -1 });

orderImportSchema.methods.toSafeJSON = function toSafeJSON() {
  const store = getStoreById(this.branch);
  return {
    id: this._id,
    branch: store,
    orderDate: this.orderDate || '',
    totalOrders: this.totalOrders || 0,
    imported: this.imported || 0,
    skippedNoMobile: this.skippedNoMobile || 0,
    skippedDuplicate: this.skippedDuplicate || 0,
    skippedVoided: this.skippedVoided || 0,
    importedAt: this.createdAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('OrderImport', orderImportSchema);
