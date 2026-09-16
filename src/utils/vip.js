import Vip from '../models/Vip.js';
import User from '../models/User.js';

export const DEFAULT_VIPS = [
  {
    name: '銅卡',
    slug: 'bronze',
    rank: 1,
    minSpend: 0,
    discountPercent: 0,
    description: '入會會員。',
  },
  {
    name: '銀卡',
    slug: 'silver',
    rank: 2,
    minSpend: 3000,
    discountPercent: 0,
    description: '累積消費滿 3,000 元，享銀卡會員權益。',
  },
  {
    name: '金卡',
    slug: 'gold',
    rank: 3,
    minSpend: 10000,
    discountPercent: 0,
    description: '累積消費滿 10,000 元，享金卡會員權益。',
  },
];

export async function ensureDefaultVips() {
  const count = await Vip.countDocuments();
  if (count) return;

  await Vip.insertMany(DEFAULT_VIPS);
}

export async function defaultVip() {
  await ensureDefaultVips();
  const vip = await Vip.findOne().sort({ rank: 1, minSpend: 1 });
  return vip;
}

export function vipToJSON(vip) {
  if (!vip) return null;
  if (typeof vip === 'object' && typeof vip.toSafeJSON === 'function') {
    return vip.toSafeJSON();
  }
  return vip;
}

export async function vipProgress(user) {
  const spend = Math.max(0, Number(user?.totalSpend) || 0);
  const vips = await Vip.find().sort({ rank: 1, minSpend: 1, _id: 1 });

  if (!vips.length) {
    return { nextVip: null, spendToNext: 0 };
  }

  const currentId = String(user?.vip?._id || user?.vip || '');
  let currentIndex = vips.findIndex((vip) => String(vip._id) === currentId);

  if (currentIndex < 0) {
    currentIndex = -1;
    vips.forEach((vip, index) => {
      if (spend >= vip.minSpend) currentIndex = index;
    });
  }

  const next = currentIndex >= 0 ? vips[currentIndex + 1] : vips[0];
  if (!next) {
    return { nextVip: null, spendToNext: 0 };
  }

  return {
    nextVip: next.toSafeJSON(),
    spendToNext: Math.max(0, Number(next.minSpend) - spend),
  };
}

export async function vipForSpend(spend = 0) {
  await ensureDefaultVips();
  const vips = await Vip.find().sort({ rank: -1, minSpend: -1 });
  return vips.find((vip) => spend >= vip.minSpend) || vips.at(-1);
}

export async function syncUserVip(user) {
  if (!user?._id) return null;

  const spend = Math.max(0, Number(user.totalSpend) || 0);
  user.totalSpend = spend;
  const next = await vipForSpend(spend);
  const update = { totalSpend: spend };

  if (next && String(user.vip || '') !== String(next._id)) {
    user.vip = next._id;
    update.vip = next._id;
  }

  await User.updateOne({ _id: user._id }, update);
  return next;
}

export async function addUserSpend(user, amount) {
  const add = Number(amount) || 0;
  if (!user?._id || add === 0) return syncUserVip(user);

  user.totalSpend = Math.max(0, (user.totalSpend || 0) + add);
  return syncUserVip(user);
}

export async function syncUsersVip(userIds) {
  const ids = [...new Set(userIds.map((id) => String(id)))];
  for (const id of ids) {
    const user = await User.findById(id);
    if (user) await syncUserVip(user);
  }
}
