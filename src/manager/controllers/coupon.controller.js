import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as couponService from '../services/coupon.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await couponService.listCoupons({
    category: req.query?.category,
  });
  return success(res, data);
});

export const create = asyncHandler(async (req, res) => {
  const data = await couponService.createCoupon(req.body || {});
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await couponService.updateCoupon(req.params.id, req.body || {});
  return success(res, data);
});

export const issue = asyncHandler(async (req, res) => {
  const data = await couponService.issueCoupon(req.params.id, req.body || {});
  return success(res, data);
});

export const use = asyncHandler(async (req, res) => {
  const data = await couponService.useUserCoupon(req.params.id);
  return success(res, data);
});
