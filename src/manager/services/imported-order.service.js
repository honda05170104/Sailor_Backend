import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';
import ImportedOrder from '../../models/ImportedOrder.js';
import { requireStore } from '../../data/stores.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function taipeiDayRange(date) {
  const start = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(start.getTime())) return null;
  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

export async function listImportedOrders({ branchId, date } = {}) {
  const filter = {};

  if (branchId) {
    const branch = requireStore(branchId);
    if (!branch) {
      throw new AppError(
        { field: 'branchId', message: '找不到分店' },
        ErrorCode.NOT_FOUND
      );
    }
    filter.branch = branch._id;
  }

  if (date) {
    if (!DATE_RE.test(String(date).trim())) {
      throw new AppError(
        { field: 'date', message: '日期格式不正確' },
        ErrorCode.BAD_REQUEST
      );
    }
    const range = taipeiDayRange(String(date).trim());
    if (!range) {
      throw new AppError(
        { field: 'date', message: '日期格式不正確' },
        ErrorCode.BAD_REQUEST
      );
    }
    filter.createdAt = { $gte: range.start, $lt: range.end };
  }

  const importedOrders = await ImportedOrder.find(filter).sort({ createdAt: -1 });
  return {
    importedOrders: importedOrders.map((doc) => doc.toSafeJSON()),
  };
}
