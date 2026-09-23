import mongoose from 'mongoose';
import { getStoreById } from '../data/stores.js';
import {
  TRANSACTION_ORDER_STATUSES,
  DEFAULT_TRANSACTION_ORDER_STATUS,
  normalizeOrderStatus,
  orderStatusLabel,
} from '../services/transactions.js';

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
      required: true,
      index: true,
    },
    /** Sailor-generated order number shown in admin. */
    txnNo: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      index: true,
    },
    pickupNo: { type: String, trim: true, default: '' },
    /** External / imported POS order number (not shown as 訂單編號). */
    orderNo: { type: String, trim: true, default: '', index: true },
    customerName: { type: String, trim: true, default: '' },
    customerMobile: { type: String, trim: true, default: '', index: true },
    source: { type: String, trim: true, default: '' },
    orderStatus: {
      type: String,
      enum: TRANSACTION_ORDER_STATUSES,
      default: DEFAULT_TRANSACTION_ORDER_STATUS,
      index: true,
    },
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
    /** When points cashback was applied; null = pending daily cashback job. */
    cashbackAt: { type: Date, default: null, index: true },
    /** Points granted from this spend order (0 if none / not yet processed). */
    cashbackPoints: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false }
);

transactionSchema.index({ branch: 1, externalOrderId: 1 }, { unique: true });

transactionSchema.methods.toSafeJSON = function toSafeJSON() {
  const store = getStoreById(this.branch);
  const orderStatus = normalizeOrderStatus(this.orderStatus);

  return {
    id: this._id,
    user: this.user,
    branch: store || (this.branch ? { id: this.branch, name: '—' } : null),
    txnNo: this.txnNo || '',
    pickupNo: this.pickupNo,
    orderNo: this.orderNo,
    customerName: this.customerName,
    customerMobile: this.customerMobile,
    source: this.source,
    orderStatus,
    orderStatusLabel: orderStatusLabel(orderStatus),
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
    cashbackAt: this.cashbackAt || null,
    cashbackPoints: this.cashbackPoints || 0,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('Transaction', transactionSchema);
