import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as importedOrderService from '../services/imported-order.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await importedOrderService.listImportedOrders(req.query || {});
  return success(res, data);
});
