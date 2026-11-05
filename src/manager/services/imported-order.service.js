import mongoose from 'mongoose';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';
import ImportedOrder from '../../models/ImportedOrder.js';
import OrderImport from '../../models/OrderImport.js';
import { requireStore } from '../../data/stores.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseOrderDate(value) {
  const date = String(value || '').trim();
  if (!DATE_RE.test(date)) return '';
  const start = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(start.getTime())) return '';
  return date;
}

function branchFilter(branchId) {
  if (!branchId) return {};
  const branch = requireStore(branchId);
  if (!branch) {
    throw new AppError(
      { field: 'branchId', message: '找不到分店' },
      ErrorCode.NOT_FOUND
    );
  }
  return { branch: branch._id };
}

export async function listOrderImports({ branchId, date } = {}) {
  const filter = branchFilter(branchId);

  if (date) {
    const orderDate = parseOrderDate(date);
    if (!orderDate) {
      throw new AppError(
        { field: 'date', message: '日期格式不正確' },
        ErrorCode.BAD_REQUEST
      );
    }
    filter.orderDate = orderDate;
  }

  const orderImports = await OrderImport.find(filter).sort({
    orderDate: -1,
    createdAt: -1,
  });
  return {
    orderImports: orderImports.map((doc) => doc.toSafeJSON()),
  };
}

function saleDatePrefix(orderDate) {
  const prefix = String(orderDate || '').replace(/-/g, '');
  return /^\d{8}$/.test(prefix) ? prefix : '';
}

/** Orders in this file, plus same-store orders whose POS number is this business day. */
async function ordersForImport(orderImport) {
  const linked = await ImportedOrder.find({ import: orderImport._id });
  const prefix = saleDatePrefix(orderImport.orderDate);
  if (!prefix) return linked;

  const bySaleDate = await ImportedOrder.find({
    branch: orderImport.branch,
    'rows.0.訂單編號': new RegExp(`^${prefix}-`),
  });

  const seen = new Set(linked.map((doc) => String(doc._id)));
  for (const doc of bySaleDate) {
    if (seen.has(String(doc._id))) continue;
    linked.push(doc);
  }
  return linked;
}

export async function getOrderImport(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new AppError(
      { field: 'id', message: '找不到匯入紀錄' },
      ErrorCode.NOT_FOUND
    );
  }

  const orderImport = await OrderImport.findById(id);
  if (!orderImport) {
    throw new AppError(
      { field: 'id', message: '找不到匯入紀錄' },
      ErrorCode.NOT_FOUND
    );
  }

  const importedOrders = await ordersForImport(orderImport);
  importedOrders.sort((a, b) => {
    const left = String(a.rows?.[0]?.['訂單編號'] || '');
    const right = String(b.rows?.[0]?.['訂單編號'] || '');
    return right.localeCompare(left);
  });

  return {
    orderImport: orderImport.toSafeJSON(),
    importedOrders: importedOrders.map((doc) => doc.toSafeJSON()),
  };
}
