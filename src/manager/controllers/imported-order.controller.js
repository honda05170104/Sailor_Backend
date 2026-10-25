import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as importedOrderService from '../services/imported-order.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await importedOrderService.listOrderImports(req.query || {});
  return success(res, data);
});

export const get = asyncHandler(async (req, res) => {
  const data = await importedOrderService.getOrderImport(req.params.id);
  return success(res, data);
});
