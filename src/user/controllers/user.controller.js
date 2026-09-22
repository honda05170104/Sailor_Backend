import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as userService from '../services/user.service.js';

export const lineToken = asyncHandler(async (req, res) => {
  const data = await userService.exchangeLineToken(req.body || {});
  return success(res, data);
});

export const line = asyncHandler(async (req, res) => {
  const data = await userService.authWithLine(req.body || {});
  return success(res, data);
});

export const dev = asyncHandler(async (req, res) => {
  const data = await userService.loginDev(req.body || {});
  return success(res, data);
});

export const logout = asyncHandler(async (req, res) => {
  const data = await userService.logout(req.user, req.token);
  return success(res, data);
});

export const get = asyncHandler(async (req, res) => {
  const data = await userService.getMe(req.user);
  return success(res, data);
});

export const getTransactions = asyncHandler(async (req, res) => {
  const data = await userService.getTransactions(req.user);
  return success(res, data);
});

export const getVips = asyncHandler(async (_req, res) => {
  const data = await userService.getVips();
  return success(res, data);
});

export const getCoupons = asyncHandler(async (req, res) => {
  const data = await userService.getCoupons(req.user);
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await userService.updateProfile(req.user, req.body || {});
  return success(res, data);
});

export const updateTags = asyncHandler(async (req, res) => {
  const data = await userService.updateTags(req.user, req.body || {});
  return success(res, data);
});

export const getAnimals = asyncHandler(async (req, res) => {
  const data = await userService.getAnimals(req.user);
  return success(res, data);
});

export const updateAnimals = asyncHandler(async (req, res) => {
  const data = await userService.updateAnimals(req.user, req.body || {});
  return success(res, data);
});

export const getMice = asyncHandler(async (req, res) => {
  const data = await userService.getMice(req.user);
  return success(res, data);
});

export const updateMice = asyncHandler(async (req, res) => {
  const data = await userService.updateMice(req.user, req.body || {});
  return success(res, data);
});

export const syncLineAvatar = asyncHandler(async (req, res) => {
  const data = await userService.syncLineAvatar(req.user, req.body || {});
  return success(res, data);
});
