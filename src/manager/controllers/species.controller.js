import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as speciesService from '../services/species.service.js';

export const list = asyncHandler(async (_req, res) => {
  const data = await speciesService.listSpecies();
  return success(res, data);
});

export const create = asyncHandler(async (req, res) => {
  const data = await speciesService.createSpecies(req.body || {});
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await speciesService.updateSpecies(req.params.id, req.body || {});
  return success(res, data);
});

export const remove = asyncHandler(async (req, res) => {
  const data = await speciesService.removeSpecies(req.params.id);
  return success(res, data);
});
