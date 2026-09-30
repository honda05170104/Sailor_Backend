import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as messageService from '../services/message.service.js';

export const broadcast = asyncHandler(async (req, res) => {
  const data = await messageService.broadcastMessage({
    q: req.body?.q,
    line: req.body?.line,
    vip: req.body?.vip,
    text: req.body?.text,
    userIds: req.body?.userIds,
  });
  return success(res, data);
});

export const broadcastCoupon = asyncHandler(async (req, res) => {
  const data = await messageService.broadcastCoupon({
    q: req.body?.q,
    line: req.body?.line,
    vip: req.body?.vip,
    couponId: req.body?.couponId,
    userIds: req.body?.userIds,
  });
  return success(res, data);
});
