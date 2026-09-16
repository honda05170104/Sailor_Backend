import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as transactionService from '../services/transaction.service.js';

export const importOrders = asyncHandler(async (req, res) => {
  const data = await transactionService.importOrderExport(req.body || {});
  return success(res, data);
});
