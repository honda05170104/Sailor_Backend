import mongoose from 'mongoose';
import Animal from '../../models/Animal.js';
import AnimalCategory from '../../models/AnimalCategory.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';

const ANIMAL_POPULATE = { path: 'category', select: 'name enabled' };

function duplicateNameError(error) {
  if (error?.code === 11000) {
    throw new AppError(
      { field: 'name', message: '名稱已存在' },
      ErrorCode.CONFLICT
    );
  }
  throw error;
}

function trimName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new AppError(
      { field: 'name', message: 'name is required' },
      ErrorCode.BAD_REQUEST
    );
  }
  return trimmed;
}

function toEnabled(value, fallback = true) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
}

function toSort(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError(
      { field: 'sort', message: 'sort must be a number' },
      ErrorCode.BAD_REQUEST
    );
  }
  return n;
}

async function requireCategory(id, field = 'categoryId') {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError({ field, message: '找不到分類' }, ErrorCode.BAD_REQUEST);
  }
  const category = await AnimalCategory.findById(id);
  if (!category) {
    throw new AppError({ field, message: '找不到分類' }, ErrorCode.NOT_FOUND);
  }
  return category;
}

export async function listAnimals() {
  const [categories, animals] = await Promise.all([
    AnimalCategory.find().sort({ sort: 1, name: 1 }),
    Animal.find().sort({ sort: 1, name: 1 }).populate(ANIMAL_POPULATE),
  ]);

  return {
    categories: categories.map((item) => item.toSafeJSON()),
    animals: animals.map((item) => item.toSafeJSON()),
  };
}

export async function createCategory({ name, description, enabled, sort } = {}) {
  try {
    const category = await AnimalCategory.create({
      name: trimName(name),
      description: String(description || '').trim(),
      enabled: toEnabled(enabled, true),
      sort: toSort(sort, 0),
    });
    return { category: category.toSafeJSON() };
  } catch (error) {
    duplicateNameError(error);
  }
}

export async function updateCategory(id, { name, description, enabled, sort } = {}) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('找不到分類', ErrorCode.NOT_FOUND);
  }
  const category = await AnimalCategory.findById(id);
  if (!category) {
    throw new AppError('找不到分類', ErrorCode.NOT_FOUND);
  }

  if (name !== undefined) category.name = trimName(name);
  if (description !== undefined) category.description = String(description || '').trim();
  if (enabled !== undefined) category.enabled = toEnabled(enabled, category.enabled);
  if (sort !== undefined) category.sort = toSort(sort, category.sort);

  try {
    await category.save();
  } catch (error) {
    duplicateNameError(error);
  }

  return { category: category.toSafeJSON() };
}

async function pullAnimalsFromUsers(animalIds) {
  if (!animalIds.length) return;
  await User.updateMany(
    { animals: { $in: animalIds } },
    { $pull: { animals: { $in: animalIds } } }
  );
}

export async function deleteCategory(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('找不到分類', ErrorCode.NOT_FOUND);
  }
  const category = await AnimalCategory.findById(id);
  if (!category) {
    throw new AppError('找不到分類', ErrorCode.NOT_FOUND);
  }

  const animals = await Animal.find({ category: category._id }).select('_id');
  const animalIds = animals.map((item) => item._id);
  await pullAnimalsFromUsers(animalIds);
  if (animalIds.length) {
    await Animal.deleteMany({ _id: { $in: animalIds } });
  }
  await category.deleteOne();
  return { ok: true };
}

export async function createAnimal({ name, categoryId, description, enabled, sort } = {}) {
  const category = await requireCategory(categoryId);
  try {
    const animal = await Animal.create({
      name: trimName(name),
      category: category._id,
      description: String(description || '').trim(),
      enabled: toEnabled(enabled, true),
      sort: toSort(sort, 0),
    });
    await animal.populate(ANIMAL_POPULATE);
    return { animal: animal.toSafeJSON() };
  } catch (error) {
    duplicateNameError(error);
  }
}

export async function updateAnimal(id, { name, categoryId, description, enabled, sort } = {}) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('找不到物種', ErrorCode.NOT_FOUND);
  }
  const animal = await Animal.findById(id);
  if (!animal) {
    throw new AppError('找不到物種', ErrorCode.NOT_FOUND);
  }

  if (name !== undefined) animal.name = trimName(name);
  if (categoryId !== undefined) {
    const category = await requireCategory(categoryId);
    animal.category = category._id;
  }
  if (description !== undefined) animal.description = String(description || '').trim();
  if (enabled !== undefined) animal.enabled = toEnabled(enabled, animal.enabled);
  if (sort !== undefined) animal.sort = toSort(sort, animal.sort);

  try {
    await animal.save();
  } catch (error) {
    duplicateNameError(error);
  }

  await animal.populate(ANIMAL_POPULATE);
  return { animal: animal.toSafeJSON() };
}

export async function deleteAnimal(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('找不到物種', ErrorCode.NOT_FOUND);
  }
  const animal = await Animal.findById(id);
  if (!animal) {
    throw new AppError('找不到物種', ErrorCode.NOT_FOUND);
  }

  await pullAnimalsFromUsers([animal._id]);
  await animal.deleteOne();
  return { ok: true };
}

export function animalPopulate() {
  return {
    path: 'animals',
    populate: ANIMAL_POPULATE,
  };
}

function sortItems(a, b) {
  return (
    (a.sort || 0) - (b.sort || 0) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant')
  );
}

export function buildCategoryTree(categories = [], animals = []) {
  const jsonCategories = categories.map((item) =>
    item && typeof item.toSafeJSON === 'function' ? item.toSafeJSON() : item
  );
  const jsonAnimals = animals.map((item) =>
    item && typeof item.toSafeJSON === 'function' ? item.toSafeJSON() : item
  );

  const animalsByCategory = new Map();
  for (const animal of jsonAnimals) {
    const key = String(animal.categoryId || animal.category?.id || animal.category || '');
    if (!key) continue;
    if (!animalsByCategory.has(key)) animalsByCategory.set(key, []);
    animalsByCategory.get(key).push(animal);
  }

  return jsonCategories
    .slice()
    .sort(sortItems)
    .map((category) => ({
      ...category,
      animals: (animalsByCategory.get(String(category.id)) || []).slice().sort(sortItems),
    }));
}

export async function listAnimalCatalog({ enabledOnly = false } = {}) {
  const filter = enabledOnly ? { enabled: { $ne: false } } : {};
  const [categories, animals] = await Promise.all([
    AnimalCategory.find(filter).sort({ sort: 1, name: 1 }),
    Animal.find(filter)
      .sort({ sort: 1, name: 1 })
      .populate(ANIMAL_POPULATE),
  ]);

  let tree = buildCategoryTree(categories, animals);
  if (enabledOnly) {
    tree = tree
      .filter((category) => category.enabled !== false)
      .map((category) => ({
        ...category,
        animals: (category.animals || []).filter((animal) => animal.enabled !== false),
      }));
  }

  return {
    categories: tree,
    animals: animals.map((animal) => animal.toSafeJSON()),
  };
}

export async function applyAnimalIds(
  user,
  animalIds = [],
  { requireEnabled = false, field = 'animalIds' } = {}
) {
  const ids = [...new Set((Array.isArray(animalIds) ? animalIds : []).filter(Boolean))];

  for (const animalId of ids) {
    if (!mongoose.isValidObjectId(animalId)) {
      throw new AppError(
        { field, message: `${field} contains an invalid id` },
        ErrorCode.BAD_REQUEST
      );
    }
  }

  if (ids.length) {
    const filter = { _id: { $in: ids } };
    if (requireEnabled) filter.enabled = { $ne: false };
    const count = await Animal.countDocuments(filter);
    if (count !== ids.length) {
      throw new AppError(
        { field, message: requireEnabled ? '找不到可用物種' : '找不到物種' },
        ErrorCode.NOT_FOUND
      );
    }
  }

  user.animals = ids;
  await user.save();
  await user.populate(['tags', animalPopulate()]);
  return user;
}
