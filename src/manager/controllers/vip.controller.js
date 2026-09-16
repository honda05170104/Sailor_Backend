import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as vipService from '../services/vip.service.js';

export const list = asyncHandler(async (_req, res) => {
  const data = await vipService.listVips();
  return success(res, data);
});

export const create = asyncHandler(async (req, res) => {
  const data = await vipService.createVip(req.body || {});
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await vipService.updateVip(req.params.id, req.body || {});
  return success(res, data);
});
