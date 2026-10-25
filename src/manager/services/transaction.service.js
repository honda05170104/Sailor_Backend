import mongoose from 'mongoose';
import User from '../../models/User.js';
import Transaction from '../../models/Transaction.js';
import ImportedOrder from '../../models/ImportedOrder.js';
import OrderImport from '../../models/OrderImport.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';
import {
  csvToObjects,
  normalizeMobile,
  parseCustomerField,
  parseImportFile,
  toNumber,
} from '../../services/orderImport.js';
import { defaultVip } from '../../services/vip.js';
import { requireStore } from '../../data/stores.js';
import {
  normalizeOrderStatus,
  generateTxnNo,
} from '../../services/transactions.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isVoidedStatus(value) {
  return String(value || '').trim() === '作廢';
}

function parseOrderDate(value) {
  const date = String(value || '').trim();
  if (!DATE_RE.test(date)) return '';
  const start = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(start.getTime())) return '';
  return date;
}

function cell(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

function groupOrders(rows) {
  const orders = new Map();

  for (const row of rows) {
    const externalOrderId = cell(row, '訂單ID', 'externalOrderId', 'orderId');
    const orderNo = cell(row, '訂單編號', 'orderNo');
    const key = externalOrderId || orderNo;
    if (!key) continue;

    const rawOrderStatus = cell(row, '訂單狀態', 'orderStatus');

    if (!orders.has(key)) {
      const customer = parseCustomerField(cell(row, '客戶', 'customer'));
      orders.set(key, {
        pickupNo: cell(row, '取單號碼', 'pickupNo'),
        orderNo,
        customerName: customer.name,
        customerMobile: customer.mobile,
        source: cell(row, '訂單來源', 'source'),
        orderStatus: normalizeOrderStatus(rawOrderStatus),
        rawOrderStatus,
        paymentStatus: cell(row, '付款狀態', 'paymentStatus'),
        shippingStatus: cell(row, '出貨狀態', 'shippingStatus'),
        tags: cell(row, '標籤', 'tags'),
        paymentMethod: cell(row, '付款方式', 'paymentMethod'),
        totalAmount: toNumber(cell(row, '總金額', 'totalAmount')),
        invoice: cell(row, '發票', 'invoice'),
        staff: cell(row, '人員', 'staff'),
        note: cell(row, '備註', 'note'),
        externalOrderId: externalOrderId || orderNo,
        items: [],
        rows: [],
      });
    }

    const grouped = orders.get(key);
    if (isVoidedStatus(rawOrderStatus)) grouped.rawOrderStatus = '作廢';
    grouped.rows.push(row);
    grouped.items.push({
      name: cell(row, '品名', 'name'),
      sku: cell(row, '貨號', 'sku'),
      barcode: cell(row, '條碼', 'barcode'),
      unitPrice: toNumber(cell(row, '售價', 'unitPrice')),
      quantity: toNumber(cell(row, '數量', 'quantity')),
      subtotal: toNumber(cell(row, '小計', 'subtotal')),
    });
  }

  return [...orders.values()];
}

function addToMobileIndex(index, user) {
  const mobile = normalizeMobile(user.mobile);
  if (mobile.length < 9) return;

  index.set(mobile, user);
  if (mobile.length === 10 && mobile.startsWith('09')) {
    index.set(mobile.slice(1), user);
  }
}

function buildMobileIndex(users) {
  const index = new Map();
  for (const user of users) addToMobileIndex(index, user);
  return index;
}

async function saveImportedOrder(branchId, order, importId) {
  try {
    const doc = await ImportedOrder.create({
      import: importId,
      branch: branchId,
      externalOrderId: order.externalOrderId,
      rows: order.rows,
    });
    return { doc, isNew: true };
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const doc = await ImportedOrder.findOne({
      branch: branchId,
      externalOrderId: order.externalOrderId,
    });
    if (!doc) throw error;
    return { doc, isNew: false };
  }
}

async function findOrCreateUser(order, mobileIndex) {
  const user =
    mobileIndex.get(order.customerMobile) ||
    mobileIndex.get(order.customerMobile.replace(/^0/, ''));

  if (user) return { user, created: false };

  try {
    const created = await User.create({
      displayName: order.customerName || '',
      mobile: order.customerMobile,
      vip: (await defaultVip())._id,
    });
    addToMobileIndex(mobileIndex, created);
    return { user: created, created: true };
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const existing = await User.findOne({ mobile: order.customerMobile });
    if (!existing) throw error;
    addToMobileIndex(mobileIndex, existing);
    return { user: existing, created: false };
  }
}

export async function importOrderExport({
  csv,
  rows,
  branchId,
  file,
  orderDate: rawOrderDate,
} = {}) {
  const id = String(branchId || '').trim();
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new AppError(
      { field: 'branchId', message: '請選擇分店' },
      ErrorCode.BAD_REQUEST
    );
  }

  const orderDate = parseOrderDate(rawOrderDate);
  if (!orderDate) {
    throw new AppError(
      { field: 'orderDate', message: '請選擇交易日期' },
      ErrorCode.BAD_REQUEST
    );
  }

  const branch = requireStore(id);
  if (!branch) {
    throw new AppError(
      { field: 'branchId', message: '找不到分店' },
      ErrorCode.NOT_FOUND
    );
  }

  let records = Array.isArray(rows) && rows.length ? rows : null;
  if (!records && file) {
    records = parseImportFile(file);
  }
  if (!records && csv) {
    records = csvToObjects(csv);
  }
  if (!records) records = [];

  if (!records.length) {
    throw new AppError(
      { field: 'file', message: '檔案是空的或格式不正確' },
      ErrorCode.BAD_REQUEST
    );
  }

  const users = await User.find({ mobile: { $nin: [null, ''] } });
  const mobileIndex = buildMobileIndex(users);
  const orders = groupOrders(records);

  const summary = {
    totalOrders: orders.length,
    imported: 0,
    createdUsers: 0,
    skippedNoMobile: 0,
    skippedDuplicate: 0,
    skippedVoided: 0,
  };

  const batch = await OrderImport.create({
    branch: branch._id,
    orderDate,
    totalOrders: orders.length,
  });

  try {
    for (const order of orders) {
      if (isVoidedStatus(order.rawOrderStatus)) {
        summary.skippedVoided += 1;
        continue;
      }

      const { doc: imported, isNew } = await saveImportedOrder(
        branch._id,
        order,
        batch._id
      );

      if (!order.customerMobile) {
        summary[isNew ? 'skippedNoMobile' : 'skippedDuplicate'] += 1;
        continue;
      }

      if (!isNew) {
        const existingTxn = await Transaction.findOne({
          branch: branch._id,
          externalOrderId: order.externalOrderId,
        });
        if (existingTxn) {
          if (!existingTxn.importedOrder) {
            existingTxn.importedOrder = imported._id;
            await existingTxn.save();
          }
          summary.skippedDuplicate += 1;
          continue;
        }
      }

      const { user, created } = await findOrCreateUser(order, mobileIndex);
      if (created) summary.createdUsers += 1;

      const transactionFields = { ...order };
      delete transactionFields.rows;
      delete transactionFields.rawOrderStatus;

      try {
        // Raw order is already stored. VIP tier / upgrade / cashback
        // are calculated by the daily agenda job (vip.dailySync).
        await Transaction.create({
          ...transactionFields,
          txnNo: generateTxnNo(),
          user: user._id,
          branch: branch._id,
          importedOrder: imported._id,
          importedAt: new Date(),
        });
        summary.imported += 1;
      } catch (error) {
        if (error?.code === 11000) {
          await Transaction.updateOne(
            {
              branch: branch._id,
              externalOrderId: order.externalOrderId,
              importedOrder: null,
            },
            { $set: { importedOrder: imported._id } }
          );
          summary.skippedDuplicate += 1;
          continue;
        }
        throw error;
      }
    }

    Object.assign(batch, summary);
    return {
      ...summary,
      import: batch.toSafeJSON(),
    };
  } finally {
    await OrderImport.updateOne(
      { _id: batch._id },
      {
        $set: {
          totalOrders: summary.totalOrders,
          imported: summary.imported,
          skippedNoMobile: summary.skippedNoMobile,
          skippedDuplicate: summary.skippedDuplicate,
          skippedVoided: summary.skippedVoided,
        },
      }
    );
  }
}
