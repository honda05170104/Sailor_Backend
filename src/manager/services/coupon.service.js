import mongoose from 'mongoose';
import Coupon from '../../models/Coupon.js';
import UserCoupon from '../../models/UserCoupon.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';
import {
  effectiveCouponStatus,
  parseCouponFields,
  parseOptionalDate,
  snapshotCoupon,
} from '../../utils/coupons.js';

async function expireStaleCoupons(userId) {
  await UserCoupon.updateMany(
    {
      user: userId,
      status: 'available',
      expiresAt: { $ne: null, $lt: new Date() },
    },
    { $set: { status: 'expired' } }
  );
}

export async function listCoupons() {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  return {
    coupons: coupons.map((coupon) => coupon.toSafeJSON()),
  };
}

export async function createCoupon(payload = {}) {
  const fields = parseCouponFields(payload);
  const coupon = await Coupon.create(fields);
  return {
    coupon: coupon.toSafeJSON(),
  };
}

export async function updateCoupon(id, payload = {}) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Coupon not found', ErrorCode.NOT_FOUND);
  }

  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw new AppError('Coupon not found', ErrorCode.NOT_FOUND);
  }

  const fields = parseCouponFields(payload, coupon);
  Object.assign(coupon, fields);
  await coupon.save();

  return {
    coupon: coupon.toSafeJSON(),
  };
}

export async function listUserCoupons(userId) {
  await expireStaleCoupons(userId);
  const coupons = await UserCoupon.find({ user: userId }).sort({
    issuedAt: -1,
    createdAt: -1,
  });
  return coupons.map((coupon) => coupon.toSafeJSON());
}

export async function countAvailableCoupons(userId) {
  await expireStaleCoupons(userId);
  return UserCoupon.countDocuments({ user: userId, status: 'available' });
}

export async function issueCoupon(userId, { couponId, expiresAt } = {}) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError('User not found', ErrorCode.NOT_FOUND);
  }
  if (!mongoose.isValidObjectId(couponId)) {
    throw new AppError(
      { field: 'couponId', message: 'couponId is required' },
      ErrorCode.BAD_REQUEST
    );
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', ErrorCode.NOT_FOUND);
  }

  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new AppError('Coupon not found', ErrorCode.NOT_FOUND);
  }
  if (coupon.enabled === false) {
    throw new AppError(
      { field: 'couponId', message: 'coupon is disabled' },
      ErrorCode.BAD_REQUEST
    );
  }

  const expiry =
    expiresAt !== undefined && expiresAt !== ''
      ? parseOptionalDate(expiresAt, 'expiresAt')
      : coupon.endsAt || null;

  if (expiry && expiry < new Date()) {
    throw new AppError(
      { field: 'expiresAt', message: 'expiresAt must be in the future' },
      ErrorCode.BAD_REQUEST
    );
  }

  const issued = await UserCoupon.create({
    user: user._id,
    ...snapshotCoupon(coupon),
    status: 'available',
    issuedAt: new Date(),
    expiresAt: expiry,
  });

  return {
    coupon: issued.toSafeJSON(),
  };
}

export async function useUserCoupon(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('Coupon not found', ErrorCode.NOT_FOUND);
  }

  const issued = await UserCoupon.findById(id);
  if (!issued) {
    throw new AppError('Coupon not found', ErrorCode.NOT_FOUND);
  }

  const status = effectiveCouponStatus(issued);
  if (status === 'used') {
    throw new AppError('Coupon already used', ErrorCode.CONFLICT);
  }
  if (status === 'expired') {
    issued.status = 'expired';
    await issued.save();
    throw new AppError('Coupon expired', ErrorCode.BAD_REQUEST);
  }

  issued.status = 'used';
  issued.usedAt = new Date();
  await issued.save();

  return {
    coupon: issued.toSafeJSON(),
  };
}
