import User from "../../models/User.js";
import { isBaseVip, listVips } from "../../data/vips.js";
import { getTimes } from "./config.service.js";
import {
  addDays,
  ymdFromParts,
  zonedInstant,
  zonedParts,
} from "../../services/globalConfig.js";

/** Same membership as the member list: 一般會員 includes people with no tier. */
function vipCountFilter(vip) {
  if (isBaseVip(vip)) {
    return {
      $or: [{ vip: vip.id }, { vip: null }, { vip: { $exists: false } }],
    };
  }
  return { vip: vip.id };
}

export async function getDashboard() {
  const times = await getTimes();
  const timeZone = times.timezone || "Asia/Taipei";
  const today = zonedParts(new Date(), timeZone);
  const next = addDays(today, 1);
  const start = zonedInstant(timeZone, today.year, today.month, today.day);
  const end = zonedInstant(timeZone, next.year, next.month, next.day);
  const vips = listVips();

  const [newMembersToday, ...vipCounts] = await Promise.all([
    User.countDocuments({
      createdAt: { $gte: start, $lt: end },
    }),
    ...vips.map((vip) => User.countDocuments(vipCountFilter(vip))),
  ]);

  return {
    date: ymdFromParts(today),
    timezone: timeZone,
    newMembersToday,
    membersByVip: vips.map((vip, index) => ({
      id: vip.id,
      name: vip.name,
      slug: vip.slug,
      count: vipCounts[index],
    })),
  };
}
