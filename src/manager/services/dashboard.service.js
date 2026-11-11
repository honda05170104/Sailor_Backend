import User from "../../models/User.js";
import ImportedOrder from "../../models/ImportedOrder.js";
import OrderImport from "../../models/OrderImport.js";
import { listStores } from "../../data/stores.js";
import { isBaseVip, listVips } from "../../data/vips.js";
import { toNumber } from "../../services/orderImport.js";
import { getTimes } from "./config.service.js";
import AppError from "../../utils/AppError.js";
import { ErrorCode } from "../../constants/codes.js";
import {
  addDays,
  parseYmd,
  ymdFromParts,
  zonedInstant,
  zonedParts,
} from "../../services/globalConfig.js";

function storeShortName(store) {
  const name = String(store?.name || "").trim();
  if (!name) return "分店";
  const dash = name.lastIndexOf("-");
  return dash >= 0 ? name.slice(dash + 1) : name;
}

function emptyTiers(vips) {
  return vips.map((vip) => ({
    id: vip.id,
    name: vip.name,
    slug: vip.slug,
    count: 0,
  }));
}

function memberTotal(tiers) {
  return tiers.reduce((sum, tier) => sum + tier.count, 0);
}

function requireYmd(value, field) {
  const parts = parseYmd(value);
  if (!parts) {
    throw new AppError(
      { field, message: "日期格式不正確" },
      ErrorCode.BAD_REQUEST
    );
  }
  return parts;
}

function resolveRange(timeZone, from, to) {
  const today = zonedParts(new Date(), timeZone);
  const defaultTo = ymdFromParts(today);
  const defaultFrom = ymdFromParts({ year: today.year, month: today.month, day: 1 });
  const start = requireYmd(from || defaultFrom, "from");
  const end = requireYmd(to || defaultTo, "to");
  const startKey = ymdFromParts(start);
  const endKey = ymdFromParts(end);
  if (startKey > endKey) {
    throw new AppError(
      { field: "from", message: "開始日期不能晚於結束日期" },
      ErrorCode.BAD_REQUEST
    );
  }
  const endExclusive = addDays(end, 1);
  return {
    from: startKey,
    to: endKey,
    fromAt: zonedInstant(timeZone, start.year, start.month, start.day),
    toAt: zonedInstant(timeZone, endExclusive.year, endExclusive.month, endExclusive.day),
  };
}

export async function getDashboard({ from, to } = {}) {
  const times = await getTimes();
  const timeZone = times.timezone || "Asia/Taipei";
  const today = zonedParts(new Date(), timeZone);
  const range = resolveRange(timeZone, from, to);
  const vips = listVips();
  const stores = listStores();
  const baseVip = vips.find((vip) => isBaseVip(vip)) || vips[0];
  const tierIndex = new Map(vips.map((vip, index) => [vip.id, index]));

  const importBatches = await OrderImport.find({
    orderDate: { $gte: range.from, $lte: range.to },
  }).select("_id");

  const [memberRows, newMemberRows, importedOrders] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: { store: "$registeredStore", vip: "$vip" },
          count: { $sum: 1 },
        },
      },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: range.fromAt, $lt: range.toAt } } },
      { $group: { _id: "$registeredStore", count: { $sum: 1 } } },
    ]),
    ImportedOrder.aggregate([
      { $match: { import: { $in: importBatches.map((batch) => batch._id) } } },
      {
        $project: {
          branch: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$rows.總金額", 0] }, { $arrayElemAt: ["$rows.totalAmount", 0] }] },
        },
      },
    ]),
  ]);

  const salesByBranch = new Map();
  for (const order of importedOrders) {
    const branchId = String(order.branch);
    const amount = toNumber(order.total);
    salesByBranch.set(branchId, (salesByBranch.get(branchId) || 0) + amount);
  }

  const newMembersByStore = new Map(
    newMemberRows.map((row) => [row._id ?? null, Number(row.count) || 0])
  );

  const storeCards = stores.map((store) => ({
    id: store.id,
    storeId: store.storeId,
    name: storeShortName(store),
    revenue: salesByBranch.get(String(store.id)) || 0,
    newMembers: newMembersByStore.get(store.storeId) || 0,
    tiers: emptyTiers(vips),
  }));
  const cardByStoreId = new Map(storeCards.map((card) => [card.storeId, card]));
  const totalTiers = emptyTiers(vips);
  let unassignedMembers = 0;
  let newMembers = 0;
  let unassignedNewMembers = 0;

  for (const row of memberRows) {
    const count = Number(row.count) || 0;
    const vipId = row._id?.vip ? String(row._id.vip) : "";
    const index = tierIndex.has(vipId) ? tierIndex.get(vipId) : tierIndex.get(baseVip?.id);
    if (index == null || index < 0) continue;
    totalTiers[index].count += count;
    const card = cardByStoreId.get(row._id?.store);
    if (card) card.tiers[index].count += count;
    else unassignedMembers += count;
  }

  for (const [storeId, count] of newMembersByStore) {
    newMembers += count;
    if (!cardByStoreId.has(storeId)) unassignedNewMembers += count;
  }

  let totalRevenue = 0;
  for (const amount of salesByBranch.values()) totalRevenue += amount;

  return {
    date: ymdFromParts(today),
    from: range.from,
    to: range.to,
    timezone: timeZone,
    total: {
      name: "全部",
      revenue: totalRevenue,
      tiers: totalTiers,
      memberTotal: memberTotal(totalTiers),
      newMembers,
      unassignedMembers,
      unassignedNewMembers,
    },
    stores: storeCards.map((card) => ({
      id: card.id,
      storeId: card.storeId,
      name: card.name,
      revenue: card.revenue,
      tiers: card.tiers,
      memberTotal: memberTotal(card.tiers),
      newMembers: card.newMembers,
    })),
  };
}
