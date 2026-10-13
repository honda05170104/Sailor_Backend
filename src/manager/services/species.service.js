import mongoose from 'mongoose';
import Species from '../../models/Species.js';
import SpeciesReview from '../../models/SpeciesReview.js';
import User from '../../models/User.js';
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

export async function listPublicSpecies() {
  const { species } = await listSpecies();
  const enabled = species.filter((item) => item.enabled !== false);
  const roots = enabled.filter((item) => !item.parentId);

  return {
    groups: roots.map((root) => ({
      id: root.id,
      name: root.name,
      options: enabled
        .filter((item) => String(item.parentId) === String(root.id))
        .map((item) => ({
          id: item.id,
          name: item.name,
        })),
    })),
  };
}

const OTHER_NAME_MAX = 80;

export async function setUserSpecies(user, payload = {}) {
  const { speciesIds } = payload;
  const otherSpecies = String(payload.otherSpecies ?? payload.other ?? '').trim();
  const ids = [
    ...new Set(
      (Array.isArray(speciesIds) ? speciesIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ];

  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(
        { field: 'speciesIds', message: '物種 id 不正確' },
        ErrorCode.BAD_REQUEST
      );
    }
  }

  const selected = ids.length
    ? await Species.find({ _id: { $in: ids } }).populate('parent')
    : [];
  if (selected.length !== ids.length) {
    throw new AppError(
      { field: 'speciesIds', message: '找不到這個物種' },
      ErrorCode.NOT_FOUND
    );
  }

  for (const item of selected) {
    if (!item.parent || item.enabled === false || item.parent.enabled === false) {
      throw new AppError(
        { field: 'speciesIds', message: '只能選擇已啟用的小類' },
        ErrorCode.BAD_REQUEST
      );
    }
  }

  if (otherSpecies.length > OTHER_NAME_MAX) {
    throw new AppError(
      { field: 'otherSpecies', message: '其他最多 80 個字' },
      ErrorCode.BAD_REQUEST
    );
  }

  user.interestedSpecies = selected.map((item) => item._id);
  user.speciesFormFilled = true;
  await user.save();
  await syncOtherSpeciesReview(user, otherSpecies);
  return user;
}

async function syncOtherSpeciesReview(user, otherSpecies) {
  const name = String(otherSpecies || '').trim();
  const now = new Date();

  if (!name) {
    await SpeciesReview.updateMany(
      { user: user._id, status: 'pending' },
      { $set: { status: 'cancelled', reviewedAt: now } }
    );
    return;
  }

  const existing = await SpeciesReview.findOne({
    user: user._id,
    name,
    status: 'pending',
  });

  await SpeciesReview.updateMany(
    {
      user: user._id,
      status: 'pending',
      ...(existing ? { _id: { $ne: existing._id } } : {}),
    },
    { $set: { status: 'cancelled', reviewedAt: now } }
  );

  if (!existing) {
    await SpeciesReview.create({
      user: user._id,
      name,
      status: 'pending',
    });
  }
}

export async function listSpeciesReviews() {
  const reviews = await SpeciesReview.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .populate('user', 'displayName mobile');

  return {
    reviews: reviews.map((review) => review.toSafeJSON()),
  };
}

async function requirePendingReview(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('找不到這筆送審', ErrorCode.NOT_FOUND);
  }

  const review = await SpeciesReview.findById(id);
  if (!review) {
    throw new AppError('找不到這筆送審', ErrorCode.NOT_FOUND);
  }
  if (review.status !== 'pending') {
    throw new AppError('這筆已經審過了', ErrorCode.BAD_REQUEST);
  }
  return review;
}

async function findOrCreateChild(parent, name) {
  let species = await Species.findOne({ parent: parent._id, name });
  if (!species) {
    try {
      species = await Species.create({
        name,
        parent: parent._id,
        sortOrder: 0,
        enabled: true,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      species = await Species.findOne({ parent: parent._id, name });
      if (!species) throwIfDuplicateName(error);
    }
  }

  if (species.enabled === false) {
    species.enabled = true;
    await species.save();
  }

  return species;
}

export async function approveSpeciesReview(id, { parentId, name } = {}) {
  const review = await requirePendingReview(id);
  const parent = await resolveParent(parentId);
  if (!parent) {
    throw new AppError(
      { field: 'parentId', message: '請選擇大類' },
      ErrorCode.BAD_REQUEST
    );
  }

  const speciesName = requireName(name ?? review.name);
  const species = await findOrCreateChild(parent, speciesName);
  const user = await User.findById(review.user);

  if (user) {
    const selected = new Set((user.interestedSpecies || []).map((item) => String(item)));
    if (!selected.has(String(species._id))) {
      user.interestedSpecies.push(species._id);
    }
    await user.save();
  }

  review.name = speciesName;
  review.status = 'approved';
  review.species = species._id;
  review.parent = parent._id;
  review.reviewedAt = new Date();
  await review.save();
  await review.populate('user', 'displayName mobile');

  return { review: review.toSafeJSON() };
}

export async function rejectSpeciesReview(id) {
  const review = await requirePendingReview(id);
  review.status = 'rejected';
  review.reviewedAt = new Date();
  await review.save();
  await review.populate('user', 'displayName mobile');
  return { review: review.toSafeJSON() };
}
