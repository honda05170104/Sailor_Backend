import mongoose from 'mongoose';

/** One POS order as imported, before it is converted into a Transaction. */
const importedOrderSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    /** POS 訂單 ID. Groups the raw rows and blocks a second import. */
    externalOrderId: {
      type: String,
      trim: true,
      required: true,
    },
    /** Original spreadsheet rows for this order, unchanged. */
    rows: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
);

importedOrderSchema.index({ branch: 1, externalOrderId: 1 }, { unique: true });

export default mongoose.model('ImportedOrder', importedOrderSchema);
