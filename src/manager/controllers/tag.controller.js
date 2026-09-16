import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as tagService from '../services/tag.service.js';

export const list = asyncHandler(async (_req, res) => {
  const data = await tagService.listTags();
  return success(res, data);
});

export const create = asyncHandler(async (req, res) => {
  const data = await tagService.createTag(req.body || {});
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await tagService.updateTag(req.params.id, req.body || {});
  return success(res, data);
});
