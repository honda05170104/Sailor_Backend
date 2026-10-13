import mongoose from 'mongoose';
import Species from '../../models/Species.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';

function parseSortOrder(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 0;
  }
  const sortOrder = Number(value);
  if (!Number.isInteger(sortOrder)) {
    throw new AppError(
      { field: 'sortOrder', message: '排序必須是整數' },
      ErrorCode.BAD_REQUEST
    );
  }
  return sortOrder;
}

function parseEnabled(value, fallback = true) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === '1') return true;
  if (text === 'false' || text === '0') return false;
  return fallback;
}

function requireName(name) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new AppError(
      { field: 'name', message: '請填名稱' },
      ErrorCode.BAD_REQUEST
    );
  }
  return trimmedName;
}

async function resolveParent(parentId) {
  if (parentId === undefined || parentId === null || String(parentId).trim() === '') {
    return null;
  }

  if (!mongoose.isValidObjectId(parentId)) {
    throw new AppError(
      { field: 'parentId', message: '找不到這個大類' },
      ErrorCode.BAD_REQUEST
    );
  }

  const parent = await Species.findById(parentId);
  if (!parent || parent.parent) {
    throw new AppError(
      { field: 'parentId', message: '只能掛在大類底下' },
      ErrorCode.BAD_REQUEST
    );
  }

  return parent;
}

function throwIfDuplicateName(error) {
  if (error?.code !== 11000) throw error;
  throw new AppError(
    { field: 'name', message: '同一層已有相同名稱' },
    ErrorCode.CONFLICT
  );
}

function compareSpecies(a, b) {
  const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (order !== 0) return order;
  return String(a.name).localeCompare(String(b.name), 'zh-Hant');
}

export async function listSpecies() {
  const species = await Species.find().populate('parent');
  const roots = species.filter((item) => !item.parent).sort(compareSpecies);
  const childrenByParent = new Map();

  for (const item of species) {
    if (!item.parent) continue;
    const parentId = String(item.parent._id || item.parent);
    const list = childrenByParent.get(parentId) || [];
    list.push(item);
    childrenByParent.set(parentId, list);
  }

  const ordered = [];
  for (const root of roots) {
    ordered.push(root);
    const children = childrenByParent.get(String(root._id)) || [];
    children.sort(compareSpecies);
    ordered.push(...children);
    childrenByParent.delete(String(root._id));
  }

  for (const children of childrenByParent.values()) {
    children.sort(compareSpecies);
    ordered.push(...children);
  }

  return {
    species: ordered.map((item) => item.toSafeJSON()),
  };
}

export async function createSpecies({ name, parentId, sortOrder, enabled } = {}) {
  const parent = await resolveParent(parentId);

  try {
    const species = await Species.create({
      name: requireName(name),
      parent: parent?._id || null,
      sortOrder: parseSortOrder(sortOrder),
      enabled: parseEnabled(enabled, true),
    });
    await species.populate('parent');
    return { species: species.toSafeJSON() };
  } catch (error) {
    throwIfDuplicateName(error);
  }
}

export async function updateSpecies(id, payload = {}) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('找不到物種', ErrorCode.NOT_FOUND);
  }

  const species = await Species.findById(id);
  if (!species) {
    throw new AppError('找不到物種', ErrorCode.NOT_FOUND);
  }

  if (payload.name !== undefined) {
    species.name = requireName(payload.name);
  }

  if (payload.parentId !== undefined) {
    const parent = await resolveParent(payload.parentId);
    if (parent && String(parent._id) === String(species._id)) {
      throw new AppError(
        { field: 'parentId', message: '不能把自己設成所屬大類' },
        ErrorCode.BAD_REQUEST
      );
    }

    const childCount = await Species.countDocuments({ parent: species._id });
    if (childCount > 0 && parent) {
      throw new AppError(
        { field: 'parentId', message: '這個大類底下已有物種，不能改成第二層' },
        ErrorCode.BAD_REQUEST
      );
    }

    species.parent = parent?._id || null;
  }

  if (payload.sortOrder !== undefined) {
    species.sortOrder = parseSortOrder(payload.sortOrder);
  }
  if (payload.enabled !== undefined) {
    species.enabled = parseEnabled(payload.enabled, species.enabled !== false);
  }

  try {
    await species.save();
  } catch (error) {
    throwIfDuplicateName(error);
  }

  await species.populate('parent');
  return { species: species.toSafeJSON() };
}

export async function removeSpecies(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('找不到物種', ErrorCode.NOT_FOUND);
  }

  const species = await Species.findById(id);
  if (!species) {
    throw new AppError('找不到物種', ErrorCode.NOT_FOUND);
  }

  const childCount = await Species.countDocuments({ parent: species._id });
  if (childCount > 0) {
    throw new AppError('這個大類底下還有物種，請先刪除', ErrorCode.BAD_REQUEST);
  }

  await species.deleteOne();
  return { id: species._id };
}
