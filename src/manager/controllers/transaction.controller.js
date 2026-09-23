import multer from 'multer';
import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as transactionService from '../services/transaction.service.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const name = String(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const ok =
      name.endsWith('.csv') ||
      name.endsWith('.txt') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      mime === 'text/csv' ||
      mime === 'text/plain' ||
      mime.includes('spreadsheetml') ||
      mime === 'application/vnd.ms-excel';

    if (ok) {
      cb(null, true);
      return;
    }

    cb(
      new AppError(
        { field: 'file', message: '只支援 CSV / TXT / XLSX' },
        ErrorCode.BAD_REQUEST
      )
    );
  },
});

export const uploadImportFile = upload.single('file');

export const importOrders = asyncHandler(async (req, res) => {
  const data = await transactionService.importOrderExport({
    ...(req.body || {}),
    file: req.file,
  });
  return success(res, data);
});
