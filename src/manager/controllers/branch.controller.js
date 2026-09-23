import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as branchService from '../services/branch.service.js';

export const list = asyncHandler(async (_req, res) => {
  const data = await branchService.listBranches();
  return success(res, data);
});
