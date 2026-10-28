import mongoose from 'mongoose';
import { getStoreById } from '../data/stores.js';
import { parseCustomerField, toNumber } from '../services/orderImport.js';

function cell(row, ...keys) {
  if (!row || typeof row !== 'object') return '';
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

/** One POS order as imported, before it is converted into a Transaction. */
const importedOrderSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    /** Parent import batch this order was read from. */
    import: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderImport',
      default: null,
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

importedOrderSchema.methods.toSafeJSON = function toSafeJSON() {
  const store = getStoreById(this.branch);
  const rows = Array.isArray(this.rows) ? this.rows : [];
  const first = rows[0] || {};
  const customer = parseCustomerField(cell(first, '客戶', 'customer'));
  return {
    id: this._id,
    import: this.import || null,
    branch: store,
    externalOrderId: this.externalOrderId || '',
    orderNo: cell(first, '訂單編號', 'orderNo'),
    customerName: customer.name,
    customerMobile: customer.mobile,
    totalAmount: toNumber(cell(first, '總金額', 'totalAmount')),
    items: rows.map((row) => ({
      name: cell(row, '品名', 'name'),
      sku: cell(row, '貨號', 'sku'),
      unitPrice: toNumber(cell(row, '售價', 'unitPrice')),
      quantity: toNumber(cell(row, '數量', 'quantity')),
      subtotal: toNumber(cell(row, '小計', 'subtotal')),
    })),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model('ImportedOrder', importedOrderSchema);
