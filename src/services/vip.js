import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import {
  VIPS,
  listVips,
  getVipById,
  getVipBySlug,
  requireVip,
  toVipJSON,
  defaultVip,
  isBaseVip,
  isGoldDowngradeProtected,
  getGoldProtectExpiresAt,
  vipRetainedBySpend,
  calcCashbackPoints,
  cashbackBonusMultiplier,
} from '../data/vips.js';
import { issueUpgradeGift } from '../manager/services/promotion.service.js';
import {
  DEFAULT_TRANSACTION_ORDER_STATUS,
  generateTxnNo,
  saleAt,
} from './transactions.js';
import { defaultStore } from '../data/stores.js';

export {
  VIPS,
  listVips,
  getVipById,
  getVipBySlug,
  requireVip,
  toVipJSON,
  defaultVip,
  isBaseVip,
  isGoldDowngradeProtected,
  getGoldProtectExpiresAt,
  vipRetainedBySpend,
  calcCashbackPoints,
};

/** Rolling window used for VIP tier thresholds. */
export const VIP_SPEND_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

/** Sources that adjust points / credits — not real purchase spend. */
export const NON_SPEND_TRANSACTION_SOURCES = [
  '後台調整',
  '點數兌換',
  '點數回饋',
  'VIP回饋', // legacy
];

export function vipToJSON(vip) {
  return toVipJSON(vip) || getVipById(vip);
}

export function vipSpendSinceDate(date = new Date()) {
  return new Date(date.getTime() - VIP_SPEND_WINDOW_MS);
}

async function sumSpend(userId, { since = null, until = null, includePositiveAdjustments = false } = {}) {
  if (!userId) return 0;
  const userOid = new mongoose.Types.ObjectId(String(userId));
  const match = {
    user: userOid,
  };
  // Manual point adds count as lifetime spend. Deductions, cashback, and redemptions do not.
  if (includePositiveAdjustments) {
    match.$or = [
      { source: { $nin: NON_SPEND_TRANSACTION_SOURCES } },
      { source: '後台調整', totalAmount: { $gt: 0 } },
    ];
  } else {
    match.source = { $nin: NON_SPEND_TRANSACTION_SOURCES };
  }
  if (since || until) {
    const saleTime = { $ifNull: ['$orderedAt', '$createdAt'] };
    const range = [];
    if (since) range.push({ $gte: [saleTime, since] });
    if (until) range.push({ $lte: [saleTime, until] });
    match.$expr = range.length === 1 ? range[0] : { $and: range };
  }

  const rows = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalAmount' },
      },
    },
  ]);
  return Math.max(0, Number(rows[0]?.total) || 0);
}

/** Lifetime spend, including backend manual point increases. */
export async function getLifetimeSpend(userId, { until = null } = {}) {
  return sumSpend(userId, { until, includePositiveAdjustments: true });
}

/** Sum paid order totals for a user within the rolling VIP window. */
export async function getYearSpend(userId, { now = new Date() } = {}) {
  return sumSpend(userId, {
    since: vipSpendSinceDate(now),
    until: now,
  });
}

/**
 * VIP tier earned from rolling spend as of a point in time (txn day).
 * Used for cashback — no upgrade side-effects.
 */
export async function vipAtDate(userId, at = new Date()) {
  const yearSpend = await getYearSpend(userId, { now: at });
  return vipForSpend(yearSpend);
}

export async function vipProgress(user) {
  const spend = await getYearSpend(user?._id || user?.id);
  const vips = VIPS;
  const vipExpiresForever = isBaseVip(getVipById(user?.vip));
  const vipExpiresAt = vipExpiresForever
    ? null
    : user?.vipExpiresAt
      ? new Date(user.vipExpiresAt)
      : null;

  if (!vips.length) {
    return {
      nextVip: null,
      spendToNext: 0,
      yearSpend: spend,
      vipExpiresAt,
      vipExpiresForever,
      goldProtectExpiresAt: null,
    };
  }

  const currentId = String(user?.vip?._id || user?.vip?.id || user?.vip || '');
  let currentIndex = vips.findIndex((vip) => String(vip.id) === currentId);

  if (currentIndex < 0) {
    currentIndex = -1;
    vips.forEach((vip, index) => {
      if (spend >= vip.minSpend) currentIndex = index;
    });
  }

  const next = currentIndex >= 0 ? vips[currentIndex + 1] : vips[0];
  if (!next) {
    return {
      nextVip: null,
      spendToNext: 0,
      yearSpend: spend,
      vipExpiresAt,
      vipExpiresForever,
      goldProtectExpiresAt: null,
    };
  }

  return {
    nextVip: toVipJSON(next),
    spendToNext: Math.max(0, Number(next.minSpend) - spend),
    yearSpend: spend,
    vipExpiresAt,
    vipExpiresForever,
    goldProtectExpiresAt: null,
  };
}

function addVipYear(date) {
  return new Date(date.getTime() + VIP_SPEND_WINDOW_MS);
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Membership year has ended. Keep or drop from spend inside that year.
 * A higher tier earned from the rolling year still upgrades.
 * If the renewed date is already past, evaluate the next year in this same run.
 */
async function resolveExpiredMembership(userId, prevVip, earned, now, expiresAt) {
  let tier = prevVip;
  let periodEnd = expiresAt;
  let periodSpend = 0;
  const prevRank = prevVip?.rank || 0;

  for (let step = 0; step < 8; step += 1) {
    const end = periodEnd || now;
    const start = new Date(end.getTime() - VIP_SPEND_WINDOW_MS);
    periodSpend = await sumSpend(userId, { since: start, until: end });
    const retained = vipRetainedBySpend(tier, periodSpend);
    const retainedRank = retained?.rank || 0;
    const earnedRank = earned?.rank || 0;

    if (retainedRank <= 1) {
      if (earnedRank > 1) {
        return {
          vip: earned,
          expiresAt: addVipYear(now),
          periodSpend,
          upgraded: earnedRank > prevRank,
          downgraded: earnedRank < prevRank,
        };
      }
      return {
        vip: retained,
        expiresAt: null,
        periodSpend,
        upgraded: false,
        downgraded: prevRank > 1,
      };
    }

    const renewed = addVipYear(end);
    if (renewed.getTime() > now.getTime()) {
      if (earnedRank > retainedRank) {
        return {
          vip: earned,
          expiresAt: addVipYear(now),
          periodSpend,
          upgraded: earnedRank > prevRank,
          downgraded: earnedRank < prevRank,
        };
      }
      return {
        vip: retained,
        expiresAt: renewed,
        periodSpend,
        upgraded: retainedRank > prevRank,
        downgraded: retainedRank < prevRank,
      };
    }

    tier = retained;
    periodEnd = renewed;
  }

  if ((earned?.rank || 0) > 1) {
    return {
      vip: earned,
      expiresAt: addVipYear(now),
      periodSpend,
      upgraded: (earned.rank || 0) > prevRank,
      downgraded: (earned.rank || 0) < prevRank,
    };
  }

  return {
    vip: defaultVip(),
    expiresAt: null,
    periodSpend,
    upgraded: false,
    downgraded: prevRank > 1,
  };
}

export async function vipForSpend(spend = 0) {
  const amount = Math.max(0, Number(spend) || 0);
  const sorted = [...VIPS].sort((a, b) => b.rank - a.rank || b.minSpend - a.minSpend);
  const vip = sorted.find((item) => amount >= item.minSpend) || VIPS[0];
  return requireVip(vip.id);
}

/**
 * Sync one member.
 * Rolling 1-year spend can raise the tier at any time.
 * A paid tier is held until vipExpiresAt. On that date, spend inside the
 * membership year decides whether it is kept, lowered, or cleared.
 */
export async function syncUserVip(user) {
  if (!user?._id) return null;

  const now = new Date();
  const lifetime = await getLifetimeSpend(user._id);
  user.totalSpend = lifetime;

  const yearSpend = await getYearSpend(user._id, { now });
  const prevVip = getVipById(user.vip);
  const earned = await vipForSpend(yearSpend);
  const prevId = String(prevVip?.id || user.vip || '');
  const prevRank = prevVip?.rank || 0;
  const earnedRank = earned?.rank || 0;
  const currentExpiry = validDate(user.vipExpiresAt);
  const manualExpiry = Boolean(user.vipExpiresManual && currentExpiry);

  let nextVip = prevVip ? requireVip(prevVip.id) : defaultVip();
  let nextExpires = currentExpiry;
  let periodSpend = null;
  let upgraded = false;
  let downgraded = false;

  if (isBaseVip(prevVip)) {
    if (earnedRank > 1) {
      nextVip = earned;
      nextExpires = addVipYear(now);
      upgraded = true;
    } else {
      nextVip = defaultVip();
      nextExpires = null;
    }
  } else if (currentExpiry && currentExpiry.getTime() > now.getTime()) {
    if (earnedRank > prevRank) {
      nextVip = earned;
      nextExpires = manualExpiry ? currentExpiry : addVipYear(now);
      upgraded = true;
    }
  } else {
    const resolved = await resolveExpiredMembership(
      user._id,
      prevVip,
      earned,
      now,
      currentExpiry
    );
    nextVip = resolved.vip;
    nextExpires = manualExpiry && !isBaseVip(resolved.vip) ? currentExpiry : resolved.expiresAt;
    periodSpend = resolved.periodSpend;
    upgraded = resolved.upgraded;
    downgraded = resolved.downgraded;
  }

  const nextId = String(nextVip?.id || nextVip?._id || '');
  const update = { totalSpend: lifetime };

  if (prevId !== nextId) {
    user.vip = nextVip._id;
    update.vip = nextVip._id;
  }

  if (isBaseVip(nextVip)) {
    nextExpires = null;
    user.vipExpiresAt = null;
    user.vipExpiresForever = false;
    user.vipExpiresManual = false;
    update.vipExpiresAt = null;
    update.vipExpiresForever = false;
    update.vipExpiresManual = false;
  } else {
    user.vipExpiresForever = false;
    update.vipExpiresForever = false;
    if (!manualExpiry) {
      user.vipExpiresAt = nextExpires;
      user.vipExpiresManual = false;
      update.vipExpiresAt = nextExpires;
      update.vipExpiresManual = false;
    }
  }

  await User.updateOne({ _id: user._id }, update);

  if (upgraded) {
    await onVipUpgraded(user, { prevVip, nextVip });
  }

  return {
    vip: nextVip,
    prevVip,
    yearSpend,
    periodSpend,
    vipExpiresAt: isBaseVip(nextVip) ? null : user.vipExpiresAt || nextExpires,
    changed: prevId !== nextId,
    upgraded,
    downgraded,
    protectedFromDowngrade: false,
  };
}

/**
 * Single place for VIP upgrade side-effects.
 * Add new upgrade-triggered behavior here only (not scattered across callers).
 */
export async function onVipUpgraded(user, { prevVip, nextVip } = {}) {
  const results = {
    prevVip: getVipById(prevVip) || prevVip || null,
    nextVip: getVipById(nextVip) || nextVip || null,
    upgradeGift: null,
  };

  try {
    results.upgradeGift = await issueUpgradeGift(user, nextVip);
  } catch (error) {
    console.error(
      'onVipUpgraded: failed to issue upgrade gift:',
      error?.message || error
    );
  }

  return results;
}

export async function syncUsersVip(userIds) {
  const ids = [...new Set(userIds.map((id) => String(id)))];
  for (const id of ids) {
    const user = await User.findById(id);
    if (user) await syncUserVip(user);
  }
}

/** Daily job: upgrade from rolling spend, and renew or drop expired memberships. */
export async function runDailyVipSync() {
  const result = {
    scanned: 0,
    upgraded: 0,
    downgraded: 0,
    protected: 0,
    unchanged: 0,
    failed: 0,
  };

  const users = await User.find({}).select(
    '_id vip totalSpend createdAt vipExpiresAt vipExpiresManual vipExpiresForever'
  );
  result.scanned = users.length;

  for (const user of users) {
    try {
      const sync = await syncUserVip(user);
      if (sync?.upgraded) result.upgraded += 1;
      else if (sync?.downgraded) result.downgraded += 1;
      else if (sync?.protectedFromDowngrade) result.protected += 1;
      else result.unchanged += 1;
    } catch (error) {
      result.failed += 1;
      console.error(
        `VIP sync failed for user ${user._id}:`,
        error?.message || error
      );
    }
  }

  return result;
}

/** Membership tier that covers a sale, if the sale sits inside that membership year. */
function cashbackVip(user, at) {
  const held = getVipById(user?.vip);
  const expiresAt = validDate(user?.vipExpiresAt);
  if (!held || isBaseVip(held) || !expiresAt) return null;
  const end = expiresAt.getTime();
  const time = new Date(at).getTime();
  if (Number.isNaN(time)) return null;
  const start = end - VIP_SPEND_WINDOW_MS;
  if (time < start || time > end) return null;
  return held;
}

/**
 * Apply points cashback for one user's pending spend transactions.
 * Rate follows the membership held on the sale date. Outside that year, rolling spend decides.
 * All points from this run are written as a single 「點數回饋」 transaction.
 */
export async function applyPendingCashbackForUser(user) {
  if (!user?._id) {
    return { points: 0, orders: 0, transaction: null };
  }

  const pending = await Transaction.find({
    user: user._id,
    cashbackAt: null,
    source: { $nin: NON_SPEND_TRANSACTION_SOURCES },
    totalAmount: { $gt: 0 },
  }).sort({ orderedAt: 1, createdAt: 1, _id: 1 });

  if (!pending.length) {
    return { points: 0, orders: 0, transaction: null };
  }

  const now = new Date();
  let totalPoints = 0;
  const updates = [];

  for (const txn of pending) {
    const at = saleAt(txn, now);
    const vip = cashbackVip(user, at) || (await vipAtDate(user._id, at));
    const bonus = cashbackBonusMultiplier(vip, at);
    const points = calcCashbackPoints(vip, txn.totalAmount, at);
    totalPoints += points;
    updates.push({
      id: txn._id,
      points,
      bonus,
      orderRef: txn.externalOrderId || txn.orderNo || txn.txnNo || String(txn._id),
      vipName: vip?.name || '',
      every: vip?.cashbackEvery || 0,
    });
  }

  // Mark all pending (including 0-point) so we never reprocess.
  for (const item of updates) {
    await Transaction.updateOne(
      { _id: item.id },
      { $set: { cashbackAt: now, cashbackPoints: item.points } }
    );
  }

  if (totalPoints <= 0) {
    return { points: 0, orders: pending.length, transaction: null };
  }

  const before = Math.max(0, Number(user.storedCredit) || 0);
  user.storedCredit = before + totalPoints;
  await User.updateOne(
    { _id: user._id },
    { $set: { storedCredit: user.storedCredit } }
  );

  const branch = defaultStore();
  const txnNo = generateTxnNo();
  const externalOrderId = `cashback-${txnNo}`;
  const noteParts = updates
    .filter((item) => item.points > 0)
    .map(
      (item) =>
        `${item.orderRef}（${item.vipName || '會員'} 滿${item.every}→${item.points}${item.bonus > 1 ? `，${item.bonus}倍` : ''}）`
    );

  const transaction = await Transaction.create({
    user: user._id,
    branch: branch._id,
    txnNo,
    orderNo: '',
    customerName: user.displayName || '',
    customerMobile: user.mobile || '',
    source: '點數回饋',
    orderStatus: DEFAULT_TRANSACTION_ORDER_STATUS,
    paymentMethod: '',
    staff: '',
    note: `點數回饋 +${totalPoints}｜${noteParts.join('、')}`,
    externalOrderId,
    items: [
      {
        name: '點數回饋',
        quantity: 1,
        unitPrice: totalPoints,
        subtotal: totalPoints,
      },
    ],
    totalAmount: totalPoints,
    importedAt: now,
    orderedAt: now,
    cashbackAt: now,
    cashbackPoints: 0,
  });

  return {
    points: totalPoints,
    orders: pending.length,
    creditedOrders: updates.filter((item) => item.points > 0).length,
    transaction,
  };
}

/** Daily job: grant pending purchase cashback (one txn per member per run). */
export async function runDailyCashback() {
  const result = {
    scanned: 0,
    creditedUsers: 0,
    skippedUsers: 0,
    totalPoints: 0,
    failed: 0,
  };

  const userIds = await Transaction.distinct('user', {
    cashbackAt: null,
    source: { $nin: NON_SPEND_TRANSACTION_SOURCES },
    totalAmount: { $gt: 0 },
  });
  result.scanned = userIds.length;

  for (const userId of userIds) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        result.skippedUsers += 1;
        continue;
      }
      const applied = await applyPendingCashbackForUser(user);
      if (applied.points > 0) {
        result.creditedUsers += 1;
        result.totalPoints += applied.points;
      } else {
        result.skippedUsers += 1;
      }
    } catch (error) {
      result.failed += 1;
      console.error(
        `Cashback failed for user ${userId}:`,
        error?.message || error
      );
    }
  }

  return result;
}
