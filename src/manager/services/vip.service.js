import mongoose from 'mongoose';
import Vip from '../../models/Vip.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';

function slugify(name, rank) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return slug || `vip-${rank}`;
}

function toNumber(value, fallback) {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function listVips() {
  const vips = await Vip.find().sort({ rank: 1, minSpend: 1 });

  return {
    vips: vips.map((vip) => vip.toSafeJSON()),
  };
}

export async function createVip({
  name,
  slug,
  rank,
  minSpend,
  discountPercent,
  description,
} = {}) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new AppError(
      { field: 'name', message: 'name is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  const parsedRank = toNumber(rank, NaN);
  if (!Number.isInteger(parsedRank) || parsedRank < 1) {
    throw new AppError(
      { field: 'rank', message: 'rank must be an integer >= 1' },
      ErrorCode.BAD_REQUEST
    );
  }

  const parsedSlug = String(slug || '').trim().toLowerCase() || slugify(trimmedName, parsedRank);

  try {
    const vip = await Vip.create({
      name: trimmedName,
      slug: parsedSlug,
      rank: parsedRank,
      minSpend: Math.max(0, toNumber(minSpend, 0)),
      discountPercent: Math.min(100, Math.max(0, toNumber(discountPercent, 0))),
      description: String(description || '').trim(),
    });

    return {
      vip: vip.toSafeJSON(),
    };
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        { field: 'slug', message: 'slug already exists' },
        ErrorCode.CONFLICT
      );
    }
    throw error;
  }
}

export async function updateVip(
  id,
  { name, slug, rank, minSpend, discountPercent, description } = {}
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('找不到會員等級', ErrorCode.NOT_FOUND);
  }

  const vip = await Vip.findById(id);
  if (!vip) {
    throw new AppError('找不到會員等級', ErrorCode.NOT_FOUND);
  }

  const trimmedName = String(name ?? vip.name).trim();
  if (!trimmedName) {
    throw new AppError(
      { field: 'name', message: 'name is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  const parsedRank = toNumber(rank, vip.rank);
  if (!Number.isInteger(parsedRank) || parsedRank < 1) {
    throw new AppError(
      { field: 'rank', message: 'rank must be an integer >= 1' },
      ErrorCode.BAD_REQUEST
    );
  }

  const parsedSlug =
    slug !== undefined
      ? String(slug || '').trim().toLowerCase() || slugify(trimmedName, parsedRank)
      : vip.slug;

  vip.name = trimmedName;
  vip.slug = parsedSlug;
  vip.rank = parsedRank;
  if (minSpend !== undefined) {
    vip.minSpend = Math.max(0, toNumber(minSpend, vip.minSpend));
  }
  if (discountPercent !== undefined) {
    vip.discountPercent = Math.min(
      100,
      Math.max(0, toNumber(discountPercent, vip.discountPercent))
    );
  }
  if (description !== undefined) {
    vip.description = String(description || '').trim();
  }

  try {
    await vip.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        { field: 'slug', message: 'slug already exists' },
        ErrorCode.CONFLICT
      );
    }
    throw error;
  }

  return {
    vip: vip.toSafeJSON(),
  };
}
