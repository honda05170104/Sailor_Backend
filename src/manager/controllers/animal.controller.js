import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as animalService from '../services/animal.service.js';

export const list = asyncHandler(async (_req, res) => {
  const data = await animalService.listAnimals();
  return success(res, data);
});

export const createCategory = asyncHandler(async (req, res) => {
  const data = await animalService.createCategory(req.body || {});
  return success(res, data);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const data = await animalService.updateCategory(req.params.id, req.body || {});
  return success(res, data);
});

export const removeCategory = asyncHandler(async (req, res) => {
  const data = await animalService.deleteCategory(req.params.id);
  return success(res, data);
});

export const create = asyncHandler(async (req, res) => {
  const data = await animalService.createAnimal(req.body || {});
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await animalService.updateAnimal(req.params.id, req.body || {});
  return success(res, data);
});

export const remove = asyncHandler(async (req, res) => {
  const data = await animalService.deleteAnimal(req.params.id);
  return success(res, data);
});
