import { calcCashbackPoints } from '../data/vips.js';
import { resolveCouponExpiresAt } from '../services/coupons.js';
import { generateTxnNo } from '../services/transactions.js';
import {
  NON_SPEND_TRANSACTION_SOURCES,
  VIP_SPEND_WINDOW_MS,
  vipForSpend,
} from '../services/vip.js';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const STAMP_MS = 10 * 1000;
const GIFT_ITEMS = {
  入會禮: '新客入會禮',
  舊會員回饋: '舊會員回饋金',
};

function taipeiDay(value) {
  return new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}

function close(a, b) {
  if (!a || !b) return false;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= STAMP_MS;
}

function saleTime(txn) {
  return new Date(txn.orderedAt || txn.createdAt);
}

function hasItem(txn, name) {
  return (txn.items || []).some((item) => String(item?.name || '').trim() === name);
}

/**
 * Move POS gift coupons, cashback, and gold expiry off the import timestamp
 * and onto the original sale time.
 */
export default {
  name: '051_sale_time_rewards',
  async up(db) {
    const coupons = await alignGiftCoupons(db);
    const points = await alignCashback(db);
    const gold = await alignGoldExpiry(db);
    console.log(
      `[051] coupons ${coupons}, cashback users ${points.users} points ${points.points}, gold ${gold}`
    );
  },
};

async function alignGiftCoupons(db) {
  const templates = new Map(
    (await db.collection('coupons').find({}).toArray()).map((doc) => [doc.name, doc])
  );
  const txns = await db.collection('transactions').find({}).toArray();
  const userCoupons = await db.collection('userCoupons').find({
    name: { $in: Object.keys(GIFT_ITEMS) },
  }).toArray();

  let updated = 0;
  for (const coupon of userCoupons) {
    const itemName = GIFT_ITEMS[coupon.name];
    const orders = txns
      .filter((txn) => String(txn.user) === String(coupon.user) && hasItem(txn, itemName))
      .sort((a, b) => saleTime(a) - saleTime(b));
    const stamp = coupon.usedAt || coupon.issuedAt;
    const matched = orders.filter(
      (txn) => close(stamp, txn.createdAt) || close(stamp, txn.importedAt) || close(coupon.issuedAt, txn.createdAt) || close(coupon.usedAt, txn.createdAt)
    );
    const order = matched[0] || null;
    if (!order?.orderedAt) continue;

    const update = {};
    if (close(coupon.issuedAt, order.createdAt) || close(coupon.issuedAt, order.importedAt)) {
      update.issuedAt = order.orderedAt;
    }
    if (close(coupon.usedAt, order.createdAt) || close(coupon.usedAt, order.importedAt)) {
      update.usedAt = order.orderedAt;
    }
    if (!update.issuedAt && !update.usedAt) continue;

    if (update.issuedAt) {
      const template = templates.get(coupon.name);
      if (template) update.expiresAt = resolveCouponExpiresAt(template, update.issuedAt);
    }

    await db.collection('userCoupons').updateOne({ _id: coupon._id }, { $set: update });
    updated += 1;
  }
  return updated;
}

async function alignCashback(db) {
  const spend = await db.collection('transactions').find({
    source: { $nin: NON_SPEND_TRANSACTION_SOURCES },
  }).toArray();

  const byUser = new Map();
  for (const txn of spend) {
    const id = String(txn.user);
    if (!byUser.has(id)) byUser.set(id, []);
    byUser.get(id).push(txn);
  }

  let users = 0;
  let points = 0;

  for (const [userId, orders] of byUser) {
    const corrections = [];
    for (const txn of orders) {
      if (!txn.cashbackAt || !(Number(txn.totalAmount) > 0)) continue;
      const at = saleTime(txn).getTime();
      const yearSpend = orders.reduce((sum, order) => {
        const time = saleTime(order).getTime();
        if (time < at - VIP_SPEND_WINDOW_MS || time > at) return sum;
        return sum + (Number(order.totalAmount) || 0);
      }, 0);
      const vip = await vipForSpend(yearSpend);
      const next = calcCashbackPoints(vip, txn.totalAmount);
      const prev = txn.cashbackPoints || 0;
      if (next === prev) continue;
      corrections.push({ txn, next, delta: next - prev });
    }
    if (!corrections.length) continue;

    const delta = corrections.reduce((sum, item) => sum + item.delta, 0);
    for (const item of corrections) {
      await db.collection('transactions').updateOne(
        { _id: item.txn._id },
        { $set: { cashbackPoints: item.next } }
      );
    }

    const user = await db.collection('users').findOne({ _id: orders[0].user });
    if (user) {
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { storedCredit: Math.max(0, (Number(user.storedCredit) || 0) + delta) } }
      );
    }
    await addCashbackLedger(db, orders[0], delta, corrections);
    users += 1;
    points += delta;
  }

  return { users, points };
}

async function addCashbackLedger(db, sample, delta, corrections) {
  const refs = corrections.map((item) => item.txn.orderNo || item.txn.txnNo).filter(Boolean);
  const noteBit = `補正 ${refs.join('、')} ${delta > 0 ? '+' : ''}${delta}（依原始消費時間）`;
  const existing = await db.collection('transactions').find({
    user: sample.user,
    source: '點數回饋',
  }).sort({ orderedAt: -1, createdAt: -1 }).limit(1).next();

  if (existing) {
    const items = Array.isArray(existing.items) && existing.items.length
      ? existing.items.map((item, index) => {
        if (index !== 0) return item;
        return {
          ...item,
          unitPrice: (Number(item.unitPrice) || 0) + delta,
          subtotal: (Number(item.subtotal) || 0) + delta,
        };
      })
      : [{ name: '點數回饋', quantity: 1, unitPrice: delta, subtotal: delta }];
    await db.collection('transactions').updateOne(
      { _id: existing._id },
      {
        $set: {
          totalAmount: (Number(existing.totalAmount) || 0) + delta,
          items,
          note: existing.note ? `${existing.note}；${noteBit}` : noteBit,
        },
      }
    );
    return;
  }

  const now = new Date();
  await db.collection('transactions').insertOne({
    user: sample.user,
    branch: sample.branch,
    txnNo: generateTxnNo(now),
    orderNo: '',
    customerName: sample.customerName || '',
    customerMobile: sample.customerMobile || '',
    source: '點數回饋',
    orderStatus: 'completed',
    note: noteBit,
    externalOrderId: `cashback-sale-time-${sample.user}`,
    items: [{ name: '點數回饋', quantity: 1, unitPrice: delta, subtotal: delta }],
    totalAmount: delta,
    importedAt: now,
    orderedAt: now,
    cashbackAt: now,
    cashbackPoints: 0,
    createdAt: now,
    updatedAt: now,
  });
}

async function alignGoldExpiry(db) {
  const txns = await db.collection('transactions').find({
    'items.name': '舊會員回饋金',
  }).toArray();
  const byUser = new Map();
  for (const txn of txns) {
    const id = String(txn.user);
    if (!byUser.has(id)) byUser.set(id, []);
    byUser.get(id).push(txn);
  }

  let updated = 0;
  for (const orders of byUser.values()) {
    orders.sort((a, b) => saleTime(a) - saleTime(b));
    const first = orders[0];
    if (!first?.orderedAt) continue;

    const user = await db.collection('users').findOne({ _id: first.user });
    if (!user?.vipExpiresAt || user.vipExpiresManual) continue;

    const saleExpiry = new Date(saleTime(first).getTime() + YEAR_MS);
    if (taipeiDay(user.vipExpiresAt) === taipeiDay(saleExpiry)) continue;

    const matchesImport = orders.some((txn) => {
      const imported = new Date(new Date(txn.createdAt).getTime() + YEAR_MS);
      return taipeiDay(imported) === taipeiDay(user.vipExpiresAt);
    });
    if (!matchesImport) continue;

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { vipExpiresAt: saleExpiry } }
    );
    updated += 1;
  }
  return updated;
}
