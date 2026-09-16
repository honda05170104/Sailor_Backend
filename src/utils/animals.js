import mongoose from 'mongoose';
import Animal from '../models/Animal.js';
import AnimalCategory from '../models/AnimalCategory.js';
import AppError from './AppError.js';
import { ErrorCode } from '../constants/codes.js';

export function animalPopulate() {
  return {
    path: 'animals',
    populate: { path: 'category', select: 'name enabled' },
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
      .populate('category', 'name enabled'),
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

export async function applyAnimalIds(user, animalIds = [], { requireEnabled = false, field = 'animalIds' } = {}) {
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
  await user.populate(['vip', 'tags', animalPopulate()]);
  return user;
}
