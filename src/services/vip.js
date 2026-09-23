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
  isGoldDowngradeProtected,
  getGoldProtectExpiresAt,
  calcCashbackPoints,
} from '../data/vips.js';
import { issueUpgradeGift } from '../manager/services/promotion.service.js';
import {
  DEFAULT_TRANSACTION_ORDER_STATUS,
  generateTxnNo,
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
  isGoldDowngradeProtected,
  getGoldProtectExpiresAt,
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

async function sumSpend(userId, { since = null, until = null } = {}) {
  if (!userId) return 0;
  const userOid = new mongoose.Types.ObjectId(String(userId));
  const match = {
    user: userOid,
    source: { $nin: NON_SPEND_TRANSACTION_SOURCES },
  };
  if (since || until) {
    match.createdAt = {};
    if (since) match.createdAt.$gte = since;
    if (until) match.createdAt.$lte = until;
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

/** Lifetime paid order totals (excludes points / adjustments). */
export async function getLifetimeSpend(userId, { until = null } = {}) {
  return sumSpend(userId, { until });
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
  const goldProtectExpiresAt = getGoldProtectExpiresAt(user);
  const vipExpiresAt = user?.vipExpiresAt ? new Date(user.vipExpiresAt) : null;

  if (!vips.length) {
    return {
      nextVip: null,
      spendToNext: 0,
      yearSpend: spend,
      vipExpiresAt,
      goldProtectExpiresAt,
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
      goldProtectExpiresAt,
    };
  }

  return {
    nextVip: toVipJSON(next),
    spendToNext: Math.max(0, Number(next.minSpend) - spend),
    yearSpend: spend,
    vipExpiresAt,
    goldProtectExpiresAt,
  };
}

/**
 * Resolve membership end date for the final VIP tier after sync.
 * - normal: no expiry
 * - upgraded: +1 year from now
 * - protected floor: gold-protect end
 * - otherwise keep future expiry, or renew +1 year if still qualifies by spend
 */
export function resolveVipExpiresAt(
  user,
  {
    now = new Date(),
    finalRank = 0,
    finalMinSpend = 0,
    yearSpend = 0,
    upgraded = false,
    protectedFromDowngrade = false,
  } = {}
) {
  if (finalRank <= 1) return null;

  const protectEnd = getGoldProtectExpiresAt(user);
  if (protectedFromDowngrade && protectEnd) {
    return protectEnd;
  }

  const oneYearLater = new Date(now.getTime() + VIP_SPEND_WINDOW_MS);
  if (upgraded) return oneYearLater;

  const current = user?.vipExpiresAt ? new Date(user.vipExpiresAt) : null;
  if (current && !Number.isNaN(current.getTime()) && current.getTime() > now.getTime()) {
    return current;
  }

  if (yearSpend >= finalMinSpend) return oneYearLater;

  if (protectEnd && protectEnd.getTime() > now.getTime() && isGoldDowngradeProtected(user, { now })) {
    return protectEnd;
  }

  return null;
}

export async function vipForSpend(spend = 0) {
  const amount = Math.max(0, Number(spend) || 0);
  const sorted = [...VIPS].sort((a, b) => b.rank - a.rank || b.minSpend - a.minSpend);
  const vip = sorted.find((item) => amount >= item.minSpend) || VIPS[0];
  return requireVip(vip.id);
}

/**
 * Sync VIP from rolling 1-year spend.
 * Lifetime totalSpend is kept separately; tier uses year window.
 * Old members (lifetime spend >= 100) are protected from falling below gold for 3 years.
 */
export async function syncUserVip(user) {
  if (!user?._id) return null;

  // Rebuild lifetime from transactions so import-only writes stay accurate.
  const lifetime = await getLifetimeSpend(user._id);
  user.totalSpend = lifetime;

  const yearSpend = await getYearSpend(user._id);
  const prevVip = getVipById(user.vip);
  let earned = await vipForSpend(yearSpend);
  const update = { totalSpend: lifetime };
  let upgraded = false;
  let protectedFromDowngrade = false;

  const prevId = String(prevVip?.id || user.vip || '');
  let nextId = String(earned?.id || earned?._id || '');
  const prevRank = prevVip?.rank || 0;
  let nextRank = earned?.rank || 0;

  // Grandfather rule: lifetime spend >= 100 → cannot fall below gold within 3 years.
  if (
    nextRank < prevRank &&
    nextRank < 2 &&
    prevRank >= 2 &&
    isGoldDowngradeProtected(user)
  ) {
    const gold = requireVip(getVipBySlug('gold')?.id);
    if (gold) {
      earned = gold;
      nextId = String(gold.id);
      nextRank = gold.rank || 2;
      protectedFromDowngrade = true;
    }
  }

  if (earned && prevId !== nextId) {
    user.vip = earned._id;
    update.vip = earned._id;
    upgraded = nextRank > prevRank;
  }

  const finalVip = getVipById(user.vip) || toVipJSON(earned);
  const finalRank = finalVip?.rank || 0;
  const vipExpiresAt = resolveVipExpiresAt(user, {
    now: new Date(),
    finalRank,
    finalMinSpend: finalVip?.minSpend || 0,
    yearSpend,
    upgraded,
    protectedFromDowngrade,
  });
  user.vipExpiresAt = vipExpiresAt;
  update.vipExpiresAt = vipExpiresAt;

  await User.updateOne({ _id: user._id }, update);

  if (upgraded) {
    await onVipUpgraded(user, { prevVip, nextVip: earned });
  }

  const finalId = String(getVipById(user.vip)?.id || user.vip || '');
  return {
    vip: getVipById(user.vip) ? requireVip(user.vip) : earned,
    prevVip,
    yearSpend,
    vipExpiresAt,
    changed: prevId !== finalId,
    upgraded,
    downgraded: Boolean(finalId !== prevId && nextRank < prevRank),
    protectedFromDowngrade,
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

/** Daily job: re-evaluate every member against rolling 1-year spend. */
export async function runDailyVipSync() {
  const result = {
    scanned: 0,
    upgraded: 0,
    downgraded: 0,
    protected: 0,
    unchanged: 0,
    failed: 0,
  };

  const users = await User.find({}).select('_id vip totalSpend createdAt');
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

/**
 * Apply points cashback for one user's pending spend transactions.
 * VIP rate = tier earned from rolling spend as of each txn's createdAt.
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
  }).sort({ createdAt: 1, _id: 1 });

  if (!pending.length) {
    return { points: 0, orders: 0, transaction: null };
  }

  const now = new Date();
  let totalPoints = 0;
  const updates = [];

  for (const txn of pending) {
    const at = txn.createdAt || now;
    const vip = await vipAtDate(user._id, at);
    const points = calcCashbackPoints(vip, txn.totalAmount);
    totalPoints += points;
    updates.push({
      id: txn._id,
      points,
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
        `${item.orderRef}（${item.vipName || '會員'} 滿${item.every}→${item.points}）`
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
