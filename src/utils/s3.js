import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'node:path';
import AppError from './AppError.js';
import { ErrorCode } from '../constants/codes.js';

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const BUCKET = process.env.S3_BUCKET || 'sailor-images';
const CLOUDFRONT_DOMAIN =
  process.env.CLOUDFRONT_DOMAIN || 'd3308oqn2orcoj.cloudfront.net';

const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const s3 = new S3Client({ region: REGION });

function publicUrlForKey(key) {
  return `https://${CLOUDFRONT_DOMAIN}/${key}`;
}

export async function uploadImageBuffer(buffer, { contentType, folder = 'banners' } = {}) {
  if (!buffer?.length) {
    throw new AppError(
      { field: 'image', message: '請選擇圖片' },
      ErrorCode.BAD_REQUEST
    );
  }

  const ext = ALLOWED_TYPES.get(String(contentType || '').toLowerCase());
  if (!ext) {
    throw new AppError(
      { field: 'image', message: '只支援 jpg、png、webp、gif' },
      ErrorCode.BAD_REQUEST
    );
  }

  const key = path.posix.join(
    folder,
    `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`
  );

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    key,
    url: publicUrlForKey(key),
  };
}
