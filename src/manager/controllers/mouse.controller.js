import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as mouseService from '../services/mouse.service.js';

export const getWeek = asyncHandler(async (req, res) => {
  const data = await mouseService.getWeek(req.query || {});
  return success(res, data);
});
