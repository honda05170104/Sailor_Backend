import mongoose from 'mongoose';
import Banner from '../../models/Banner.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';
import { uploadImageBuffer } from '../../utils/s3.js';

function trimText(value) {
  return String(value || '').trim();
}

function parseSortOrder(value) {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError(
      { field: 'sortOrder', message: 'sortOrder must be a number' },
      ErrorCode.BAD_REQUEST
    );
  }
  return n;
}

function parseEnabled(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
}

async function uploadBannerImage(file) {
  if (!file) return null;
  const uploaded = await uploadImageBuffer(file.buffer, {
    contentType: file.mimetype,
    folder: 'banners',
  });
  return uploaded.url;
}

export async function listBanners({ enabledOnly = false } = {}) {
  const filter = enabledOnly ? { enabled: { $ne: false } } : {};
  const banners = await Banner.find(filter).sort({ sortOrder: 1, createdAt: -1 });
  return {
    banners: banners.map((banner) => banner.toSafeJSON()),
  };
}

export async function createBanner(payload = {}, file) {
  const imageUrl = await uploadBannerImage(file);
  if (!imageUrl) {
    throw new AppError(
      { field: 'image', message: '請選擇圖片' },
      ErrorCode.BAD_REQUEST
    );
  }

  const banner = await Banner.create({
    imageUrl,
    linkUrl: trimText(payload.linkUrl),
    sortOrder: parseSortOrder(payload.sortOrder),
    enabled: parseEnabled(payload.enabled, true),
  });

  return { banner: banner.toSafeJSON() };
}

export async function updateBanner(id, payload = {}, file) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Banner not found', ErrorCode.NOT_FOUND);
  }

  const banner = await Banner.findById(id);
  if (!banner) {
    throw new AppError('Banner not found', ErrorCode.NOT_FOUND);
  }

  if (payload.linkUrl !== undefined) banner.linkUrl = trimText(payload.linkUrl);
  if (payload.sortOrder !== undefined) {
    banner.sortOrder = parseSortOrder(payload.sortOrder);
  }
  if (payload.enabled !== undefined) {
    banner.enabled = parseEnabled(payload.enabled, banner.enabled !== false);
  }

  const imageUrl = await uploadBannerImage(file);
  if (imageUrl) banner.imageUrl = imageUrl;

  await banner.save();
  return { banner: banner.toSafeJSON() };
}

export async function removeBanner(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Banner not found', ErrorCode.NOT_FOUND);
  }

  const banner = await Banner.findById(id);
  if (!banner) {
    throw new AppError('Banner not found', ErrorCode.NOT_FOUND);
  }

  await banner.deleteOne();
  return { ok: true };
}
