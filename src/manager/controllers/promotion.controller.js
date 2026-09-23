import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as promotionService from '../services/promotion.service.js';

export const list = asyncHandler(async (_req, res) => {
  const data = await promotionService.listPromotions();
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await promotionService.updatePromotion(
    req.params.id,
    req.body || {}
  );
  return success(res, data);
});
