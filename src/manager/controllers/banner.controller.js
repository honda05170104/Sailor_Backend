import multer from 'multer';
import asyncHandler from '../../middleware/asyncHandler.js';
import { success } from '../../utils/response.js';
import * as bannerService from '../services/banner.service.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (String(file.mimetype || '').startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(
      new AppError(
        { field: 'image', message: '只支援圖片檔' },
        ErrorCode.BAD_REQUEST
      )
    );
  },
});

export const uploadBannerImage = upload.single('image');

export const list = asyncHandler(async (_req, res) => {
  const data = await bannerService.listBanners();
  return success(res, data);
});

export const create = asyncHandler(async (req, res) => {
  const data = await bannerService.createBanner(req.body || {}, req.file);
  return success(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await bannerService.updateBanner(
    req.params.id,
    req.body || {},
    req.file
  );
  return success(res, data);
});

export const remove = asyncHandler(async (req, res) => {
  const data = await bannerService.removeBanner(req.params.id);
  return success(res, data);
});
