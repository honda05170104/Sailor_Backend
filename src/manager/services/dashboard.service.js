import User from "../../models/User.js";
import Transaction from "../../models/Transaction.js";
import { listStores } from "../../data/stores.js";
import { isBaseVip, listVips } from "../../data/vips.js";
import { NON_SPEND_TRANSACTION_SOURCES } from "../../services/vip.js";
import { getTimes } from "./config.service.js";
import { ymdFromParts, zonedInstant, zonedParts } from "../../services/globalConfig.js";

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

export async function getDashboard() {
  const times = await getTimes();
  const timeZone = times.timezone || "Asia/Taipei";
  const today = zonedParts(new Date(), timeZone);
  const monthStart = zonedInstant(timeZone, today.year, today.month, 1);
  const nextMonth =
    today.month === 12
      ? { year: today.year + 1, month: 1 }
      : { year: today.year, month: today.month + 1 };
  const monthEnd = zonedInstant(timeZone, nextMonth.year, nextMonth.month, 1);
  const vips = listVips();
  const stores = listStores();
  const baseVip = vips.find((vip) => isBaseVip(vip)) || vips[0];
  const tierIndex = new Map(vips.map((vip, index) => [vip.id, index]));

  const [memberRows, salesRows] = await Promise.all([
    User.aggregate([
      {
        $group: {
          _id: { store: "$registeredStore", vip: "$vip" },
          count: { $sum: 1 },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { source: { $nin: NON_SPEND_TRANSACTION_SOURCES } } },
      { $addFields: { saleAt: { $ifNull: ["$orderedAt", "$createdAt"] } } },
      { $match: { saleAt: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: "$branch", total: { $sum: "$totalAmount" } } },
    ]),
  ]);

  const salesByBranch = new Map(
    salesRows.map((row) => [String(row._id), Number(row.total) || 0])
  );
  const storeCards = stores.map((store) => ({
    id: store.id,
    storeId: store.storeId,
    name: storeShortName(store),
    revenue: salesByBranch.get(String(store.id)) || 0,
    tiers: emptyTiers(vips),
  }));
  const cardByStoreId = new Map(storeCards.map((card) => [card.storeId, card]));
  const totalTiers = emptyTiers(vips);
  let unassignedMembers = 0;

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

  let totalRevenue = 0;
  for (const amount of salesByBranch.values()) totalRevenue += amount;

  const month = `${today.year}-${String(today.month).padStart(2, "0")}`;

  return {
    date: ymdFromParts(today),
    month,
    timezone: timeZone,
    total: {
      name: "全部",
      revenue: totalRevenue,
      tiers: totalTiers,
      memberTotal: memberTotal(totalTiers),
      unassignedMembers,
    },
    stores: storeCards.map((card) => ({
      id: card.id,
      storeId: card.storeId,
      name: card.name,
      revenue: card.revenue,
      tiers: card.tiers,
      memberTotal: memberTotal(card.tiers),
    })),
  };
}
