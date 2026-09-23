import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as vipService from '../services/vip.service.js';

export const list = asyncHandler(async (_req, res) => {
  const data = await vipService.listVipsForManager();
  return success(res, data);
});

export const runDailySync = asyncHandler(async (_req, res) => {
  const data = await vipService.runVipDailySync();
  return success(res, data);
});

export const runDailyCashback = asyncHandler(async (_req, res) => {
  const data = await vipService.runVipDailyCashback();
  return success(res, data);
});
