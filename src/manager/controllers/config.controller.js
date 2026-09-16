import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as configService from '../services/config.service.js';

export const get = asyncHandler(async (_req, res) => {
  const data = await configService.getConfig();
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await configService.updateConfig(req.body || {});
  return success(res, data);
});
