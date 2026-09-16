import AppError from './AppError.js';
import { ErrorCode } from '../constants/codes.js';

export const COUPON_TYPES = ['amount', 'percent'];
export const USER_COUPON_STATUSES = ['available', 'used', 'expired'];

export function effectiveCouponStatus(doc) {
  if (doc.status === 'used') return 'used';
  if (doc.status === 'expired') return 'expired';
  if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) return 'expired';
  return 'available';
}

export function parseOptionalDate(value, field) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      { field, message: `${field} must be a valid date` },
      ErrorCode.BAD_REQUEST
    );
  }
  return date;
}

function toNonNegativeNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError(
      { field, message: `${field} must be a number >= 0` },
      ErrorCode.BAD_REQUEST
    );
  }
  return n;
}

export function parseCouponFields(payload = {}, fallback = {}) {
  const name = String(payload.name ?? fallback.name ?? '').trim();
  if (!name) {
    throw new AppError(
      { field: 'name', message: 'name is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  const type = String(payload.type ?? fallback.type ?? '').trim();
  if (!COUPON_TYPES.includes(type)) {
    throw new AppError(
      { field: 'type', message: 'type must be amount or percent' },
      ErrorCode.BAD_REQUEST
    );
  }

  const value = toNonNegativeNumber(payload.value ?? fallback.value, 'value');
  if (type === 'percent' && value > 100) {
    throw new AppError(
      { field: 'value', message: 'percent value must be <= 100' },
      ErrorCode.BAD_REQUEST
    );
  }

  const minSpend = toNonNegativeNumber(
    payload.minSpend ?? fallback.minSpend ?? 0,
    'minSpend'
  );

  const startsAt =
    payload.startsAt !== undefined
      ? parseOptionalDate(payload.startsAt, 'startsAt')
      : fallback.startsAt ?? null;
  const endsAt =
    payload.endsAt !== undefined
      ? parseOptionalDate(payload.endsAt, 'endsAt')
      : fallback.endsAt ?? null;

  if (startsAt && endsAt && startsAt > endsAt) {
    throw new AppError(
      { field: 'endsAt', message: 'endsAt must be after startsAt' },
      ErrorCode.BAD_REQUEST
    );
  }

  const enabled =
    payload.enabled === undefined
      ? fallback.enabled !== false
      : Boolean(payload.enabled);

  return {
    name,
    description: String(payload.description ?? fallback.description ?? '').trim(),
    type,
    value,
    minSpend,
    startsAt,
    endsAt,
    enabled,
  };
}

export function snapshotCoupon(coupon) {
  return {
    coupon: coupon._id,
    name: coupon.name,
    description: coupon.description || '',
    type: coupon.type,
    value: coupon.value,
    minSpend: coupon.minSpend || 0,
  };
}
