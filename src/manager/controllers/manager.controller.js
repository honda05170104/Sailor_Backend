import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as managerService from '../services/manager.service.js';

export const login = asyncHandler(async (req, res) => {
  const data = await managerService.login(req.body || {});
  return success(res, data);
});

export const logout = asyncHandler(async (req, res) => {
  const data = await managerService.logout(req.manager, req.token);
  return success(res, data);
});

export const me = asyncHandler(async (req, res) => {
  const data = await managerService.getMe(req.manager);
  return success(res, data);
});
