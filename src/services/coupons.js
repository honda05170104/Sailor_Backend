import AppError from '../utils/AppError.js';
import { ErrorCode } from '../constants/codes.js';

export const COUPON_TYPES = ['amount', 'percent'];
export const COUPON_EXPIRY_MODES = ['fixed', 'relative'];
/** Gift / purpose category for admin filters. */
export const COUPON_CATEGORIES = ['general', 'upgrade', 'birthday'];
export const COUPON_CATEGORY_LABELS = {
  general: '一般',
  upgrade: '升等禮',
  birthday: '生日禮',
};
export const USER_COUPON_STATUSES = ['available', 'used', 'expired'];
/** How the coupon was issued to the user. */
export const USER_COUPON_SOURCES = ['manual', 'promotion'];
export const USER_COUPON_SOURCE_LABELS = {
  manual: '手動發放',
  promotion: '優惠活動',
};

export function normalizeCouponCategory(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  // Legacy: 入會禮 was its own category; fold into 升等禮.
  if (raw === 'join') return 'upgrade';
  return COUPON_CATEGORIES.includes(raw) ? raw : 'general';
}

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

function toPositiveInt(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    throw new AppError(
      { field, message: `${field} must be an integer >= 1` },
      ErrorCode.BAD_REQUEST
    );
  }
  return Math.floor(n);
}

/** Infer expiry mode for legacy coupons that predate expiryMode. */
export function normalizeExpiryMode(coupon = {}) {
  const mode = String(coupon.expiryMode || '').trim();
  if (COUPON_EXPIRY_MODES.includes(mode)) return mode;
  if (coupon.expireDays != null && Number(coupon.expireDays) > 0) return 'relative';
  return 'fixed';
}

/**
 * Compute UserCoupon.expiresAt from coupon template.
 * @param {object} coupon
 * @param {Date} [issuedAt]
 */
export function resolveCouponExpiresAt(coupon, issuedAt = new Date()) {
  const mode = normalizeExpiryMode(coupon);
  if (mode === 'relative') {
    const days = Number(coupon.expireDays);
    if (!Number.isFinite(days) || days < 1) return null;
    const expires = new Date(issuedAt);
    expires.setDate(expires.getDate() + Math.floor(days));
    return expires;
  }
  return coupon.endsAt || null;
}

/** Whether a coupon template can still be issued right now. */
export function assertCouponIssuable(coupon, now = new Date()) {
  const mode = normalizeExpiryMode(coupon);
  if (mode !== 'fixed') return;

  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    throw new AppError(
      { field: 'couponId', message: 'coupon has not started yet' },
      ErrorCode.BAD_REQUEST
    );
  }
  if (coupon.endsAt && new Date(coupon.endsAt) < now) {
    throw new AppError(
      { field: 'couponId', message: 'coupon campaign has ended' },
      ErrorCode.BAD_REQUEST
    );
  }
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

  const expiryModeRaw =
    payload.expiryMode !== undefined
      ? String(payload.expiryMode || '').trim()
      : normalizeExpiryMode(fallback);
  const expiryMode = COUPON_EXPIRY_MODES.includes(expiryModeRaw)
    ? expiryModeRaw
    : 'fixed';

  let startsAt = null;
  let endsAt = null;
  let expireDays = null;

  if (expiryMode === 'fixed') {
    startsAt =
      payload.startsAt !== undefined
        ? parseOptionalDate(payload.startsAt, 'startsAt')
        : fallback.startsAt ?? null;
    endsAt =
      payload.endsAt !== undefined
        ? parseOptionalDate(payload.endsAt, 'endsAt')
        : fallback.endsAt ?? null;

    if (!startsAt) {
      throw new AppError(
        { field: 'startsAt', message: 'startsAt is required for fixed expiry' },
        ErrorCode.BAD_REQUEST
      );
    }
    if (!endsAt) {
      throw new AppError(
        { field: 'endsAt', message: 'endsAt is required for fixed expiry' },
        ErrorCode.BAD_REQUEST
      );
    }
    if (startsAt > endsAt) {
      throw new AppError(
        { field: 'endsAt', message: 'endsAt must be after startsAt' },
        ErrorCode.BAD_REQUEST
      );
    }
  } else {
    const rawDays =
      payload.expireDays !== undefined
        ? payload.expireDays
        : fallback.expireDays;
    expireDays = toPositiveInt(rawDays, 'expireDays');
  }

  const enabled =
    payload.enabled === undefined
      ? fallback.enabled !== false
      : Boolean(payload.enabled);

  const categoryRaw =
    payload.category !== undefined
      ? String(payload.category || '').trim().toLowerCase()
      : fallback.category;
  const category = normalizeCouponCategory(categoryRaw);

  return {
    name,
    description: String(payload.description ?? fallback.description ?? '').trim(),
    type,
    value,
    minSpend,
    expiryMode,
    startsAt,
    endsAt,
    expireDays,
    category,
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
