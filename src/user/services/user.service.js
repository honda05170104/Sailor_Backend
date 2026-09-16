import crypto from 'crypto';
import User from '../../models/User.js';
import Token from '../../models/Token.js';
import Transaction from '../../models/Transaction.js';
import Vip from '../../models/Vip.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';
import { getVerifiedLineProfile } from './line.service.js';
import { normalizeMobile } from '../../utils/orderImport.js';
import { defaultVip, syncUserVip, vipProgress } from '../../utils/vip.js';
import { applyTagIds } from '../../utils/tags.js';
import { applyAnimalIds, animalPopulate, listAnimalCatalog } from '../../utils/animals.js';
import { presentUserMouseOrder, setUserMouseOrder } from '../../utils/mouseOrders.js';
import { getTimes } from '../../manager/services/config.service.js';
import { listUserCoupons, countAvailableCoupons } from '../../manager/services/coupon.service.js';

async function presentUser(user) {
  if (!user.populated('vip')) await user.populate('vip');
  if (!user.populated('tags')) await user.populate('tags');
  if (!user.populated('animals')) await user.populate(animalPopulate());
  const progress = await vipProgress(user);
  return {
    ...user.toSafeJSON(),
    couponCount: await countAvailableCoupons(user._id),
    nextVip: progress.nextVip,
    spendToNext: progress.spendToNext,
  };
}

async function requireAccessToken(accessToken) {
  if (!accessToken) {
    throw new AppError(
      { field: 'accessToken', message: 'accessToken is required' },
      ErrorCode.BAD_REQUEST
    );
  }
}

async function getLineProfileOrThrow(accessToken) {
  try {
    return await getVerifiedLineProfile(accessToken);
  } catch {
    throw new AppError('Invalid LINE access token', ErrorCode.UNAUTHORIZED);
  }
}

async function issueAuthToken(user) {
  await Token.deleteMany({ user: user._id });

  const tokenDoc = await Token.create({
    token: crypto.randomBytes(32).toString('hex'),
    issuedAt: new Date(),
    user: user._id,
  });

  return tokenDoc.token;
}

async function listTransactions(user) {
  const transactions = await Transaction.find({ user: user._id })
    .sort({ createdAt: -1 })
    .populate('branch', 'name type');

  return transactions.map((doc) => doc.toSafeJSON());
}

async function claimImportedUserByMobile(user, mobile) {
  if (!mobile || mobile.length < 9) return;

  const existing = await User.findOne({
    _id: { $ne: user._id },
    mobile,
  });

  if (!existing) return;

  if (existing.lineUserId) {
    throw new AppError(
      { field: 'mobile', message: 'mobile already in use' },
      ErrorCode.CONFLICT
    );
  }

  await Transaction.updateMany(
    { user: existing._id },
    { $set: { user: user._id } }
  );

  if (!user.displayName && existing.displayName) {
    user.displayName = existing.displayName;
  }
  if (!user.birthday && existing.birthday) {
    user.birthday = existing.birthday;
  }
  user.totalSpend = (user.totalSpend || 0) + (existing.totalSpend || 0);
  user.prepaidFeed = (user.prepaidFeed || 0) + (existing.prepaidFeed || 0);
  user.storedCredit = (user.storedCredit || 0) + (existing.storedCredit || 0);

  await existing.deleteOne();
  await syncUserVip(user);
}

export async function authWithLine({ accessToken }) {
  await requireAccessToken(accessToken);
  const profile = await getLineProfileOrThrow(accessToken);

  let user = await User.findOne({ lineUserId: profile.lineUserId });
  const isNew = !user;

  if (!user) {
    user = await User.create({
      lineUserId: profile.lineUserId,
      displayName: profile.displayName || '',
      avatarUrl: profile.avatarUrl || '',
      vip: (await defaultVip())._id,
    });
  } else {
    user.displayName = profile.displayName || user.displayName;
    if (!user.avatarUrl && profile.avatarUrl) {
      user.avatarUrl = profile.avatarUrl;
    }
    await user.save();
  }

  const token = await issueAuthToken(user);

  return {
    token,
    user: await presentUser(user),
    isNew,
  };
}

export async function loginDev({ lineUserId, displayName, avatarUrl } = {}) {
  if (process.env.ALLOW_DEV_LOGIN !== 'true') {
    throw new AppError('Dev login is disabled', ErrorCode.FORBIDDEN);
  }

  let user = await User.findOne({ lineUserId: lineUserId || 'dev-user' });

  if (!user) {
    user = await User.create({
      lineUserId: lineUserId || 'dev-user',
      displayName: displayName || 'Dev User',
      avatarUrl: avatarUrl || '',
      vip: (await defaultVip())._id,
    });
  } else {
    user.displayName = displayName || user.displayName;
    await user.save();
  }

  const token = await issueAuthToken(user);

  return {
    token,
    user: await presentUser(user),
  };
}

export async function logout(user, token) {
  if (token) {
    await Token.deleteOne({ token, user: user._id });
  } else {
    await Token.deleteMany({ user: user._id });
  }
  return null;
}

export async function getMe(user) {
  return {
    user: await presentUser(user),
  };
}

export async function getVips() {
  const vips = await Vip.find().sort({ rank: 1, minSpend: 1 });
  return {
    vips: vips.map((vip) => vip.toSafeJSON()),
  };
}

export async function getCoupons(user) {
  const coupons = await listUserCoupons(user._id);
  return {
    couponCount: coupons.filter((coupon) => coupon.status === 'available').length,
    coupons,
  };
}

export async function updateTags(user, { tagIds } = {}) {
  await applyTagIds(user, tagIds);
  return {
    user: await presentUser(user),
  };
}

export async function getAnimals(user) {
  const data = await listAnimalCatalog({ enabledOnly: true });
  const animals = data.categories.flatMap((category) => category.animals || []);
  const animalIds = (user?.animals || []).map((item) =>
    String(item.id || item._id || item)
  );
  return {
    categories: data.categories,
    animals,
    animalIds,
  };
}

export async function updateAnimals(user, { animalIds } = {}) {
  await applyAnimalIds(user, animalIds, { requireEnabled: true, field: 'animalIds' });
  return {
    user: await presentUser(user),
  };
}

export async function getMice(user) {
  return presentUserMouseOrder(await getTimes(), user);
}

export async function updateMice(user, payload = {}) {
  return setUserMouseOrder(await getTimes(), user, payload);
}

export async function getTransactions(user) {
  return {
    transactions: await listTransactions(user),
  };
}

export async function updateProfile(user, payload = {}) {
  const allowed = ['birthday', 'mobile'];

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      user[key] = String(payload[key]).trim();
    }
  }

  if (payload.mobile !== undefined) {
    user.mobile = normalizeMobile(user.mobile);
    await claimImportedUserByMobile(user, user.mobile);
    await syncUserVip(user);
  }

  await user.save();

  return {
    user: await presentUser(user),
  };
}

export async function syncLineAvatar(user, { accessToken }) {
  await requireAccessToken(accessToken);
  const profile = await getLineProfileOrThrow(accessToken);

  if (profile.lineUserId !== user.lineUserId) {
    throw new AppError('LINE account mismatch', ErrorCode.FORBIDDEN);
  }

  if (!profile.avatarUrl) {
    throw new AppError('LINE account has no avatar', ErrorCode.BAD_REQUEST);
  }

  user.avatarUrl = profile.avatarUrl;
  await user.save();

  return {
    user: await presentUser(user),
  };
}
