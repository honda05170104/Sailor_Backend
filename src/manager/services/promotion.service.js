import mongoose from 'mongoose';
import Coupon from '../../models/Coupon.js';
import Promotion, { PROMOTION_TYPES } from '../../models/Promotion.js';
import PromotionClaim from '../../models/PromotionClaim.js';
import UserCoupon from '../../models/UserCoupon.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';
import { snapshotCoupon, resolveCouponExpiresAt } from '../../services/coupons.js';
import { getVipById, getVipBySlug } from '../../data/vips.js';

/** Taiwan local date parts for birthday matching. */
function taiwanNowParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [year, month, day] = fmt.format(date).split('-');
  return { year, month, day };
}

/** Accept YYYY-MM-DD or MM-DD. */
export function parseBirthdayMonth(birthday) {
  const raw = String(birthday || '').trim();
  if (!raw) return null;
  const match = raw.match(/(?:^|\D)(\d{4}-)?(\d{1,2})-(\d{1,2})(?:\D|$)/);
  if (!match) return null;
  const month = String(match[2]).padStart(2, '0');
  const day = String(match[3]).padStart(2, '0');
  if (Number(month) < 1 || Number(month) > 12) return null;
  if (Number(day) < 1 || Number(day) > 31) return null;
  return { month, day };
}

export async function listPromotions({ enabledOnly = false } = {}) {
  const filter = enabledOnly ? { enabled: true } : {};
  const promotions = await Promotion.find(filter)
    .populate('coupon')
    .sort({ createdAt: 1 });

  const order = {
    join: 0,
    'upgrade-gold': 1,
    'upgrade-black': 2,
    'birthday-gold': 3,
    'birthday-black': 4,
  };
  promotions.sort(
    (a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99)
  );

  return {
    promotions: promotions.map((doc) => doc.toSafeJSON()),
  };
}

export async function updatePromotion(id, payload = {}) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Promotion not found', ErrorCode.NOT_FOUND);
  }

  const promotion = await Promotion.findById(id);
  if (!promotion) {
    throw new AppError('Promotion not found', ErrorCode.NOT_FOUND);
  }

  if (payload.name !== undefined) {
    const name = String(payload.name || '').trim();
    if (!name) {
      throw new AppError(
        { field: 'name', message: 'name is required' },
        ErrorCode.BAD_REQUEST
      );
    }
    promotion.name = name;
  }

  if (payload.description !== undefined) {
    promotion.description = String(payload.description || '').trim();
  }

  if (payload.enabled !== undefined) {
    promotion.enabled = Boolean(payload.enabled);
  }

  if (payload.couponId !== undefined) {
    const couponId = String(payload.couponId || '').trim();
    if (!couponId) {
      promotion.coupon = null;
    } else {
      if (!mongoose.isValidObjectId(couponId)) {
        throw new AppError(
          { field: 'couponId', message: 'couponId is invalid' },
          ErrorCode.BAD_REQUEST
        );
      }
      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        throw new AppError(
          { field: 'couponId', message: 'coupon not found' },
          ErrorCode.BAD_REQUEST
        );
      }
      promotion.coupon = coupon._id;
    }
  }

  await promotion.save();
  await promotion.populate('coupon');

  return {
    promotion: promotion.toSafeJSON(),
  };
}

async function findEnabledByType(type) {
  if (!PROMOTION_TYPES.includes(type)) return null;
  return Promotion.findOne({ type, enabled: true }).populate('coupon');
}

async function tryClaimAndIssue(user, promotion, claimKey) {
  if (!user?._id || !promotion?._id || !claimKey) return null;
  if (!promotion.coupon) return null;

  const coupon =
    promotion.coupon && typeof promotion.coupon.toSafeJSON === 'function'
      ? promotion.coupon
      : await Coupon.findById(promotion.coupon);

  if (!coupon || coupon.enabled === false) return null;

  try {
    await PromotionClaim.create({
      user: user._id,
      promotion: promotion._id,
      claimKey,
    });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }

  const issuedAt = new Date();
  const expiresAt = resolveCouponExpiresAt(coupon, issuedAt);
  const issued = await UserCoupon.create({
    user: user._id,
    ...snapshotCoupon(coupon),
    status: 'available',
    source: 'promotion',
    promotion: promotion._id,
    promotionName: promotion.name || '',
    issuedAt,
    expiresAt,
  });

  await PromotionClaim.updateOne(
    { user: user._id, claimKey },
    { $set: { userCoupon: issued._id } }
  );

  return issued;
}

/** New LINE member — once. */
export async function issueJoinGift(user) {
  const promotion = await findEnabledByType('join');
  if (!promotion) return null;
  return tryClaimAndIssue(user, promotion, `join:${promotion.key}`);
}

/**
 * VIP rank increased — once per target tier (gold / black different coupons).
 * Prefer calling via onVipUpgraded() in services/vip.js (upgrade side-effects hub).
 * @param {object} user
 * @param {object} toVip — vip JSON / requireVip result after upgrade
 */
export async function issueUpgradeGift(user, toVip) {
  const vip = getVipById(toVip) || toVip;
  const vipId = String(vip?.id || vip?._id || '');
  const slug = String(vip?.slug || '').trim().toLowerCase();
  if (!vipId || (vip?.rank || 0) <= 1) return null;
  if (slug !== 'gold' && slug !== 'black') return null;

  const promotion = await Promotion.findOne({
    key: `upgrade-${slug}`,
    type: 'upgrade',
    enabled: true,
  }).populate('coupon');
  if (!promotion) return null;
  return tryClaimAndIssue(user, promotion, `upgrade:${vipId}`);
}

/**
 * VIP birthday gift — gold 100 / black 500, once per calendar year.
 * Issued on the 1st of the birthday month (Asia/Taipei).
 */
export async function issueBirthdayGift(user, { forceDayOne = true } = {}) {
  const vip = getVipById(user?.vip);
  const slug = String(vip?.slug || '').trim().toLowerCase();
  if (slug !== 'gold' && slug !== 'black') return null;

  const parts = parseBirthdayMonth(user?.birthday);
  if (!parts) return null;

  const now = taiwanNowParts();
  if (parts.month !== now.month) return null;
  if (forceDayOne && now.day !== '01') return null;

  const promotion = await Promotion.findOne({
    key: `birthday-${slug}`,
    type: 'birthday',
    enabled: true,
  }).populate('coupon');
  if (!promotion) return null;
  return tryClaimAndIssue(user, promotion, `birthday:${slug}:${now.year}`);
}

/**
 * Monthly agenda check (Asia/Taipei, 1st of month).
 * Birthday gifts issue only on the 1st of the birthday month.
 */
export async function runDailyPromotionChecks() {
  const now = taiwanNowParts();
  const result = {
    date: `${now.year}-${now.month}-${now.day}`,
    birthday: { eligible: false, scanned: 0, issued: 0, skipped: 0 },
  };

  if (now.day !== '01') {
    return result;
  }

  result.birthday.eligible = true;
  const month = now.month;
  const goldVipId = getVipBySlug('gold')?.id;
  const blackVipId = getVipBySlug('black')?.id;
  const vipIds = [goldVipId, blackVipId].filter(Boolean);

  const users = await User.find({
    birthday: { $gt: '' },
    ...(vipIds.length ? { vip: { $in: vipIds } } : {}),
    $or: [
      { birthday: { $regex: `-${month}-` } },
      { birthday: { $regex: `^${month}-` } },
    ],
  }).select('_id birthday vip');

  result.birthday.scanned = users.length;

  for (const user of users) {
    try {
      const issued = await issueBirthdayGift(user, { forceDayOne: true });
      if (issued) result.birthday.issued += 1;
      else result.birthday.skipped += 1;
    } catch (error) {
      result.birthday.skipped += 1;
      console.error(
        `Birthday gift failed for user ${user._id}:`,
        error?.message || error
      );
    }
  }

  return result;
}

export async function issuePendingPromotions(user, { isNew = false } = {}) {
  const results = [];
  if (isNew) {
    const join = await issueJoinGift(user);
    if (join) results.push(join);
  }
  // Birthday gifts are issued by Agenda on the 1st of the birthday month.
  return results;
}
