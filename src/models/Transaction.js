import mongoose from 'mongoose';

const transactionItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    sku: { type: String, trim: true, default: '' },
    barcode: { type: String, trim: true, default: '' },
    unitPrice: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    pickupNo: { type: String, trim: true, default: '' },
    orderNo: { type: String, trim: true, default: '', index: true },
    customerName: { type: String, trim: true, default: '' },
    customerMobile: { type: String, trim: true, default: '', index: true },
    source: { type: String, trim: true, default: '' },
    orderStatus: { type: String, trim: true, default: '' },
    paymentStatus: { type: String, trim: true, default: '' },
    shippingStatus: { type: String, trim: true, default: '' },
    tags: { type: String, trim: true, default: '' },
    paymentMethod: { type: String, trim: true, default: '' },
    totalAmount: { type: Number, default: 0 },
    invoice: { type: String, trim: true, default: '' },
    staff: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    externalOrderId: { type: String, trim: true, default: '', index: true },
    items: { type: [transactionItemSchema], default: [] },
    importedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

transactionSchema.index({ branch: 1, externalOrderId: 1 }, { unique: true });

transactionSchema.methods.toSafeJSON = function toSafeJSON() {
  const branch = this.branch;
  const branchJSON =
    branch && typeof branch === 'object' && branch.name != null
      ? { id: branch._id, name: branch.name, type: branch.type }
      : branch;

  return {
    id: this._id,
    user: this.user,
    branch: branchJSON,
    pickupNo: this.pickupNo,
    orderNo: this.orderNo,
    customerName: this.customerName,
    customerMobile: this.customerMobile,
    source: this.source,
    orderStatus: this.orderStatus,
    paymentStatus: this.paymentStatus,
    shippingStatus: this.shippingStatus,
    tags: this.tags,
    paymentMethod: this.paymentMethod,
    totalAmount: this.totalAmount,
    invoice: this.invoice,
    staff: this.staff,
    note: this.note,
    externalOrderId: this.externalOrderId,
    items: this.items,
    importedAt: this.importedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Transaction', transactionSchema);
